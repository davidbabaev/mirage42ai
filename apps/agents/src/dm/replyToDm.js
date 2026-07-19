const { compileReplyPrompt, buildReplyMessage } = require('./replyPrompt');
const { REPLY_JSON_SCHEMA, parseReply } = require('../llm/replySchema');
const { isAwake } = require('../scheduler');
const { DEFAULT_MODEL, DEFAULT_MAX_TOKENS } = require('../llm/decide');

/**
 * The inbound-DM reply path (master-plan §6).
 *
 * A DM does NOT wait for the next heartbeat. §6 calls for a "near-time reply
 * path with a human-feeling typing delay (e.g. 30s-15min, persona-dependent),
 * not an instant bot reply" — so this is triggered by the socket the moment a
 * message arrives, then deliberately waits.
 *
 * THE DELAY IS A FEATURE, NOT A LIMITATION. An instant reply is the single
 * loudest bot tell there is: nobody answers a message in 400ms, and nobody
 * answers every message in exactly the same 400ms. The wait is randomised and
 * scaled to the length of what is being written.
 */

/**
 * How long a person takes to notice a message and type an answer.
 *
 * Two components, because they model different things: a NOTICE delay (you
 * were doing something else) plus a TYPING delay proportional to the length of
 * the reply. A three-word "haha yeah" should not take the same time as four
 * sentences.
 */
const NOTICE_MIN_MS = 30_000;       // §6's floor: 30s
const NOTICE_MAX_MS = 15 * 60_000;  // §6's ceiling: 15min
const MS_PER_CHAR = 60;             // ~200 chars/min, an unhurried phone typist

const replyDelayMs = ({ replyLength = 0, random = Math.random, persona } = {}) => {
    // A persona may be a fast or slow replier; default to the middle.
    const eagerness = typeof persona?.replyEagerness === 'number'
        ? Math.min(1, Math.max(0, persona.replyEagerness))
        : 0.5;

    // Eager personas sit nearer the floor of the notice window.
    const span = NOTICE_MAX_MS - NOTICE_MIN_MS;
    const ceiling = NOTICE_MIN_MS + span * (1 - eagerness);
    const notice = NOTICE_MIN_MS + random() * Math.max(0, ceiling - NOTICE_MIN_MS);

    const typing = replyLength * MS_PER_CHAR;
    return Math.round(notice + typing);
};

/**
 * Handles one inbound DM end to end.
 *
 * Everything is injected so the whole path is testable without a server, an
 * API key, or a fifteen-minute wait.
 *
 * @returns {Promise<{replied: boolean, skipped?: string, text?: string}>}
 */
const replyToDm = async ({
    message,          // a single inbound Message (kept for one-off callers)
    messages,         // OR the coalesced batch from dmQueue — one burst, one reply
    agent,            // { user, persona } from the roster
    session,          // AgentSession — the agent's OWN token: thread reads, sends
    runtimeSession,   // AgentSession — the ADMIN token: memory reads/writes only
    chatSocket,       // AgentChatSocket — the send
    llmClient,
    budget,
    audit,
    now = Date.now(),
    random = Math.random,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    api,              // { fetchThread, loadMemory, writeMemory }
    decideImpl,       // injectable LLM call
} = {}) => {
    const { user, persona } = agent;
    const agentId = String(user._id);
    const agentName = [user.name, user.lastName].filter(Boolean).join(' ');

    // One burst is one turn of conversation. The batch may also contain the
    // socket's echo of our OWN sends, which are not something to answer.
    const batch = (messages && messages.length ? messages : [message]).filter(Boolean);
    const inbound = batch.filter((m) => String(m.userId) !== agentId);

    const skip = (why, detail) => {
        audit.skipped({ agentId, agentName, why, detail });
        return { replied: false, skipped: why };
    };

    // Never answer yourself. The socket echoes sent messages to BOTH parties,
    // so without this the agent would reply to its own reply, forever.
    if (!inbound.length) return { replied: false, skipped: 'own-message' };

    // The newest message decides who we are talking to; the THREAD (fetched
    // below) is what the model actually reads, so every message in the batch
    // is accounted for whether or not it appears here.
    const newest = inbound[inbound.length - 1];
    const counterpartId = String(newest.userId);

    if (!persona) return skip('no-persona');
    if (persona.enabled === false) return skip('persona-disabled');
    if (user.isBanned) return skip('account-banned');

    // Asleep means asleep. A reply at 4am local time undoes every other bit of
    // realism in one message. It is NOT queued for later on purpose: a human
    // who was asleep replies to what is on screen in the morning, and that is
    // the next heartbeat's job, not a stale reply to a 6-hour-old line.
    if (!isAwake(persona, now)) return skip('outside-active-hours');

    const llmBudget = budget.check(agentId, 'llmCalls', persona.dailyBudget || {});
    if (!llmBudget.allowed) {
        return skip('llm-budget-exhausted', `${llmBudget.spent}/${llmBudget.cap} calls used today`);
    }

    // --- gather: the thread, and what she remembers about this person --------
    let thread = [];
    let memory = { events: [], facts: [] };
    let counterpartName = 'they';
    try {
        const gathered = await api.fetchThread(session, {
            conversationId: newest.conversationId,
            counterpartId,
        });
        thread = gathered.messages || [];
        counterpartName = gathered.counterpartName || 'they';
        // Memory lives behind the ADMIN-guarded runtime endpoint, so it takes
        // the runtime session. The agent's own token gets a 403 here — which
        // killed every reply until this was fixed.
        memory = await api.loadMemory(runtimeSession, agentId, counterpartId);
    } catch (err) {
        return skip('dm-context-failed', err.message);
    }

    // --- one LLM call --------------------------------------------------------
    let result;
    try {
        result = await decideImpl({
            client: llmClient,
            systemPrompt: compileReplyPrompt({ persona, memory, counterpartName }),
            userMessage: buildReplyMessage({ thread, agentUserId: agentId, counterpartName }),
        });
    } catch (err) {
        return skip('llm-call-failed', err.message);
    } finally {
        budget.record(agentId, 'llmCalls');
    }

    const parsed = parseReply(result.raw);
    audit.record({
        type: 'dm_decision',
        agentId, agentName,
        withUserId: counterpartId,
        // How many inbound messages this ONE reply answers. >1 means the queue
        // coalesced a burst; a run of these all reading 1 during a burst is the
        // regression this field exists to make visible.
        batched: inbound.length,
        replying: Boolean(parsed.reply.reply),
        reason: parsed.reply.reason || undefined,
        valid: parsed.ok,
        error: parsed.ok ? undefined : parsed.error,
        inputTokens: result.usage?.input_tokens,
        outputTokens: result.usage?.output_tokens,
    });

    const text = (parsed.reply.reply || '').trim();

    // A remembered fact is worth keeping even when she chose not to reply —
    // "he asked and I ignored it" is exactly the kind of thing that should
    // shape the next conversation.
    if (parsed.reply.fact) {
        try {
            await api.writeMemory(runtimeSession, agentId, {
                events: [{
                    type: 'dm_received', withUserId: counterpartId,
                    // The whole burst, not just the last line — "you're gorgeous"
                    // followed by "want a drink?" is one advance, and a memory
                    // holding only the second half loses what was actually said.
                    summary: `${counterpartName}: ${inbound
                        .map((m) => String(m.text || '').trim())
                        .filter(Boolean)
                        .join(' / ')
                        .slice(0, 200)}`,
                }],
                facts: [{ userId: counterpartId, fact: parsed.reply.fact }],
            });
        } catch (err) {
            audit.record({ type: 'memory_write_failed', agentId, detail: err.message });
        }
    }

    if (!text) return { replied: false, skipped: 'chose-not-to-reply' };

    const actionBudget = budget.check(agentId, 'actions', persona.dailyBudget || {});
    if (!actionBudget.allowed) {
        return skip('action-budget-exhausted', `${actionBudget.spent}/${actionBudget.cap} actions used today`);
    }

    // --- the human-feeling pause --------------------------------------------
    const delay = replyDelayMs({ replyLength: text.length, random, persona });
    audit.record({ type: 'dm_delay', agentId, agentName, withUserId: counterpartId, delayMs: delay });
    await sleep(delay);

    // --- send, and only then record that she said it ------------------------
    try {
        await chatSocket.sendMessage({ toUser: counterpartId, text });
    } catch (err) {
        // The send is ack'd, so a failure here is a REAL failure, not a
        // silently buffered message. Record it as such and do NOT write "I
        // replied" into memory for something that was never delivered.
        audit.action({
            agentId, agentName, action: 'dm_reply', target: counterpartId,
            ok: false, detail: err.message,
        });
        return { replied: false, skipped: 'send-failed' };
    }

    budget.record(agentId, 'actions');
    audit.action({ agentId, agentName, action: 'dm_reply', target: counterpartId, ok: true });

    // Marking read is what makes the startup sweep IDEMPOTENT: `unreadCount` is
    // derived from `lastReadAt`, so without this every restart would find the
    // same conversations unread and answer them all over again. It is also just
    // true — she read them. Uses her OWN session; it is her read pointer.
    try {
        await api.markRead?.(session, newest.conversationId);
    } catch (err) {
        audit.record({ type: 'mark_read_failed', agentId, detail: err.message });
    }

    try {
        await api.writeMemory(runtimeSession, agentId, {
            events: [{
                type: 'dm_sent', withUserId: counterpartId,
                summary: `I replied to ${counterpartName}: ${text.slice(0, 200)}`,
            }],
        });
    } catch (err) {
        audit.record({ type: 'memory_write_failed', agentId, detail: err.message });
    }

    return { replied: true, text, delayMs: delay };
};

module.exports = {
    replyToDm, replyDelayMs,
    NOTICE_MIN_MS, NOTICE_MAX_MS, MS_PER_CHAR,
    REPLY_JSON_SCHEMA, DEFAULT_MODEL, DEFAULT_MAX_TOKENS,
};
