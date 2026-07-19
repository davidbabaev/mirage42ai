const { compilePersonaPrompt } = require('./persona/prompt');
const { decide } = require('./llm/decide');
const { isAwake } = require('./scheduler');
const actions = require('./api/actions');

/**
 * One heartbeat, for one agent (master-plan §6, "Decision loop (per tick)").
 *
 *   gather context via the public API
 *     -> ONE cheap LLM call for a structured decision
 *     -> execute it through the public API
 *     -> write to the audit trail
 *
 * The gates run BEFORE the LLM call, in this order, because each one makes the
 * call unnecessary and an unnecessary call is money:
 *   1. persona disabled          (per-agent pause)
 *   2. account banned            (a banned agent must go quiet, not keep trying)
 *   3. outside waking hours      (§6: nobody posts at 4am)
 *   4. daily LLM budget spent    (§11: cost discipline lives in code)
 *
 * Everything is injected so the whole tick is testable without a server, an
 * API key, or a clock.
 */

const localTimeString = (timezone, now) => {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(new Date(now));
    } catch {
        return null;
    }
};

/** Cards this agent has already liked — so a "like" never becomes an unlike. */
const markAlreadyLiked = (cards, agentId) =>
    (cards || []).map((card) => ({
        ...card,
        likedByMe: Array.isArray(card.likes) && card.likes.some(id => String(id) === String(agentId)),
    }));

/**
 * Executes a validated decision. Returns { action, target, ok, detail }.
 * Never throws — an action failure is recorded and the tick ends calmly.
 */
const executeDecision = async ({ session, decision, api = actions }) => {
    try {
        switch (decision.action) {
            case 'post': {
                const card = await api.createPost(session, decision.text);
                return { action: 'post', target: card?._id, ok: true };
            }
            case 'like': {
                await api.likeCard(session, decision.cardId);
                return { action: 'like', target: decision.cardId, ok: true };
            }
            case 'comment': {
                await api.commentOnCard(session, decision.cardId, decision.text);
                return { action: 'comment', target: decision.cardId, ok: true };
            }
            default:
                return { action: 'do_nothing', ok: true };
        }
    } catch (err) {
        return { action: decision.action, target: decision.cardId, ok: false, detail: err.message };
    }
};

/**
 * Runs one tick for one agent.
 * @returns {Promise<{acted: boolean, action: string, skipped?: string}>}
 */
const runTick = async ({
    session,
    llmClient,
    agent,            // { user, persona } from the roster
    budget,
    audit,
    now = Date.now(),
    api = actions,
    decideImpl = decide,
}) => {
    const { user, persona } = agent;
    const agentId = String(user._id);
    const agentName = [user.name, user.lastName].filter(Boolean).join(' ');
    const skip = (why, detail) => {
        audit.skipped({ agentId, agentName, why, detail });
        return { acted: false, action: 'do_nothing', skipped: why };
    };

    if (!persona) return skip('no-persona', 'agent account has no persona document');
    if (persona.enabled === false) return skip('persona-disabled');
    if (user.isBanned) return skip('account-banned');
    if (!isAwake(persona, now)) return skip('outside-active-hours');

    const llmBudget = budget.check(agentId, 'llmCalls', persona.dailyBudget || {});
    if (!llmBudget.allowed) {
        return skip('llm-budget-exhausted', `${llmBudget.spent}/${llmBudget.cap} calls used today`);
    }

    // --- gather context through the public API -----------------------------
    let feed = [];
    let notifications = [];
    try {
        const [feedBody, notifs] = await Promise.all([
            api.fetchFeed(session),
            api.fetchNotifications(session).catch(() => []),
        ]);
        feed = markAlreadyLiked(feedBody?.cards, agentId);
        notifications = notifs;
    } catch (err) {
        return skip('context-fetch-failed', err.message);
    }

    // --- one cheap LLM call ------------------------------------------------
    const systemPrompt = compilePersonaPrompt(persona, {
        localTime: localTimeString(persona.timezone, now),
        recentActivity: audit.entries
            .filter(e => e.type === 'action' && e.agentId === agentId && e.ok)
            .slice(-5)
            .map(e => `${e.action}${e.target ? ` (${e.target})` : ''}`),
    });

    let result;
    try {
        result = await decideImpl({ client: llmClient, systemPrompt, feed, notifications });
    } catch (err) {
        // A transport failure is an outage, not a quiet tick — say so.
        return skip('llm-call-failed', err.message);
    } finally {
        // Recorded even on failure: a failed call still costs, and a run that
        // keeps failing must not retry unboundedly against the daily cap.
        budget.record(agentId, 'llmCalls');
    }

    audit.decision({
        agentId, agentName,
        decision: result.decision,
        usage: result.usage,
        valid: result.valid,
        refused: result.refused,
        error: result.error,
    });

    const { decision } = result;
    if (decision.action === 'do_nothing') return { acted: false, action: 'do_nothing' };

    // Re-liking toggles a like OFF. The model cannot be relied on to remember,
    // so the guard lives here rather than in the prompt.
    if (decision.action === 'like') {
        const card = feed.find(c => String(c._id) === String(decision.cardId));
        if (card?.likedByMe) {
            audit.action({
                agentId, agentName, action: 'like', target: decision.cardId,
                ok: false, detail: 'already liked — a second like would unlike it',
            });
            return { acted: false, action: 'do_nothing' };
        }
    }

    const actionBudget = budget.check(agentId, 'actions', persona.dailyBudget || {});
    if (!actionBudget.allowed) {
        return skip('action-budget-exhausted', `${actionBudget.spent}/${actionBudget.cap} actions used today`);
    }

    const outcome = await executeDecision({ session, decision, api });
    if (outcome.ok) budget.record(agentId, 'actions');
    audit.action({ agentId, agentName, ...outcome });

    return { acted: outcome.ok, action: decision.action };
};

module.exports = { runTick, executeDecision, markAlreadyLiked, localTimeString };
