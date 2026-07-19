// One heartbeat, end to end, with everything injected.
//
// The properties that matter here are all NEGATIVE ones — what the agent must
// NOT do. do_nothing must write nothing; an exhausted budget must not call the
// model; a sleeping agent must not touch the API at all. Those are exactly the
// behaviours a happy-path test misses.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { runTick, markAlreadyLiked } = requireFromHere('../src/loop.js');
const { BudgetLedger } = requireFromHere('../src/budget.js');
const { AuditTrail } = requireFromHere('../src/audit.js');

// 09:00 UTC = 12:00 Jerusalem — inside Maya's 07:00-23:00 window.
const AWAKE = Date.parse('2026-07-19T09:00:00Z');
// 01:00 UTC = 04:00 Jerusalem — outside it.
const ASLEEP = Date.parse('2026-07-19T01:00:00Z');

const AGENT = {
    user: { _id: 'agent-1', name: 'maya', lastName: 'ben-ari', isBanned: false },
    persona: {
        name: 'Maya Ben-Ari', age: 31, timezone: 'Asia/Jerusalem',
        activeHours: { start: 7, end: 23 },
        relationship: { status: 'married', openToRomance: false },
        dailyBudget: { llmCalls: 40, actions: 20, images: 1 },
        enabled: true,
    },
};

const FEED_CARDS = [
    { _id: 'card-1', content: 'made bread', likes: [], creator: { name: 'dana' } },
    { _id: 'card-2', content: 'beach day', likes: ['agent-1'], creator: { name: 'noa' } },
];

const mkApi = (over = {}) => ({
    fetchFeed: vi.fn(async () => ({ cards: FEED_CARDS, nextCursor: null })),
    fetchNotifications: vi.fn(async () => []),
    createPost: vi.fn(async () => ({ _id: 'new-card' })),
    likeCard: vi.fn(async () => ({ _id: 'card-1' })),
    commentOnCard: vi.fn(async () => ({ _id: 'card-1' })),
    ...over,
});

const mkHarness = (decision, { api, agent = AGENT, decideThrows } = {}) => {
    const budget = new BudgetLedger({ clock: () => AWAKE });
    const audit = new AuditTrail({ sink: { log: () => {} }, clock: () => 'T' });
    const decideImpl = decideThrows
        ? vi.fn(async () => { throw new Error(decideThrows); })
        : vi.fn(async () => ({ decision, usage: { input_tokens: 500, output_tokens: 15 }, valid: true }));
    return { budget, audit, decideImpl, api: api || mkApi(), agent };
};

const tick = (h, now = AWAKE) => runTick({
    session: {}, llmClient: {}, agent: h.agent,
    budget: h.budget, audit: h.audit, api: h.api, decideImpl: h.decideImpl, now,
});

describe('runTick — do_nothing is inert', () => {
    it('writes NOTHING to the API', async () => {
        const h = mkHarness({ action: 'do_nothing', reason: 'nothing worth reacting to' });
        const result = await tick(h);

        expect(result.acted).toBe(false);
        expect(h.api.createPost).not.toHaveBeenCalled();
        expect(h.api.likeCard).not.toHaveBeenCalled();
        expect(h.api.commentOnCard).not.toHaveBeenCalled();
    });

    it('still records the tick and spends an LLM call', async () => {
        const h = mkHarness({ action: 'do_nothing', reason: 'quiet afternoon' });
        await tick(h);

        const entry = h.audit.entries.find(e => e.type === 'decision');
        expect(entry.action).toBe('do_nothing');
        expect(entry.reason).toBe('quiet afternoon');
        expect(h.budget.spentToday('agent-1').llmCalls).toBe(1);
        // ...but no ACTION budget was consumed.
        expect(h.budget.spentToday('agent-1').actions).toBe(0);
    });
});

describe('runTick — executing a decision', () => {
    it('a post decision calls POST /cards with the text', async () => {
        const h = mkHarness({ action: 'post', text: 'the sea was flat today' });
        const result = await tick(h);

        expect(h.api.createPost).toHaveBeenCalledWith({}, 'the sea was flat today');
        expect(result.acted).toBe(true);
        expect(h.budget.spentToday('agent-1').actions).toBe(1);
        expect(h.audit.entries.find(e => e.type === 'action')).toMatchObject({
            action: 'post', target: 'new-card', ok: true,
        });
    });

    it('a like decision calls the like toggle', async () => {
        const h = mkHarness({ action: 'like', cardId: 'card-1' });
        await tick(h);
        expect(h.api.likeCard).toHaveBeenCalledWith({}, 'card-1');
    });

    it('a comment decision posts the text to the card', async () => {
        const h = mkHarness({ action: 'comment', cardId: 'card-1', text: 'looks great' });
        await tick(h);
        expect(h.api.commentOnCard).toHaveBeenCalledWith({}, 'card-1', 'looks great');
    });

    it('REFUSES to re-like a post — a second like would silently UNLIKE it', async () => {
        // card-2 already carries agent-1 in its likes array.
        const h = mkHarness({ action: 'like', cardId: 'card-2' });
        const result = await tick(h);

        expect(h.api.likeCard).not.toHaveBeenCalled();
        expect(result.acted).toBe(false);
        expect(h.audit.entries.find(e => e.type === 'action')).toMatchObject({
            ok: false, detail: expect.stringMatching(/already liked/),
        });
    });

    it('records a failed action instead of throwing', async () => {
        const api = mkApi({ createPost: vi.fn(async () => { throw new Error('429 Too many'); }) });
        const h = mkHarness({ action: 'post', text: 'hello' }, { api });

        const result = await tick(h);

        expect(result.acted).toBe(false);
        expect(h.audit.entries.find(e => e.type === 'action')).toMatchObject({
            ok: false, detail: expect.stringMatching(/429/),
        });
        // A failed action must not consume the action budget.
        expect(h.budget.spentToday('agent-1').actions).toBe(0);
    });
});

describe('runTick — the gates run BEFORE the LLM call', () => {
    it('a sleeping agent does not touch the API or the model', async () => {
        const h = mkHarness({ action: 'post', text: 'x' });
        const result = await tick(h, ASLEEP);

        expect(result.skipped).toBe('outside-active-hours');
        expect(h.decideImpl).not.toHaveBeenCalled();
        expect(h.api.fetchFeed).not.toHaveBeenCalled();
        expect(h.budget.spentToday('agent-1').llmCalls).toBe(0);
    });

    it('a disabled persona is skipped', async () => {
        const agent = { ...AGENT, persona: { ...AGENT.persona, enabled: false } };
        const h = mkHarness({ action: 'post', text: 'x' }, { agent });
        expect((await tick(h)).skipped).toBe('persona-disabled');
        expect(h.decideImpl).not.toHaveBeenCalled();
    });

    it('a BANNED agent goes quiet rather than hammering the API', async () => {
        const agent = { ...AGENT, user: { ...AGENT.user, isBanned: true } };
        const h = mkHarness({ action: 'post', text: 'x' }, { agent });
        expect((await tick(h)).skipped).toBe('account-banned');
        expect(h.api.fetchFeed).not.toHaveBeenCalled();
    });

    it('an agent with no persona is skipped loudly, not crashed on', async () => {
        const agent = { user: AGENT.user, persona: null };
        const h = mkHarness({ action: 'post', text: 'x' }, { agent });
        expect((await tick(h)).skipped).toBe('no-persona');
    });

    it('an exhausted LLM budget stops the call being made at all', async () => {
        const agent = { ...AGENT, persona: { ...AGENT.persona, dailyBudget: { llmCalls: 2, actions: 20 } } };
        const h = mkHarness({ action: 'do_nothing' }, { agent });

        await tick(h);
        await tick(h);
        const third = await tick(h);

        expect(third.skipped).toBe('llm-budget-exhausted');
        expect(h.decideImpl).toHaveBeenCalledTimes(2); // not 3
    });

    it('an exhausted ACTION budget still allows thinking but blocks writing', async () => {
        const agent = { ...AGENT, persona: { ...AGENT.persona, dailyBudget: { llmCalls: 40, actions: 1 } } };
        const h = mkHarness({ action: 'post', text: 'hello there' }, { agent });

        await tick(h);
        const second = await tick(h);

        expect(second.skipped).toBe('action-budget-exhausted');
        expect(h.api.createPost).toHaveBeenCalledTimes(1);
    });
});

describe('runTick — failures are recorded, never silent', () => {
    it('a failed context fetch skips the tick with a reason', async () => {
        const api = mkApi({ fetchFeed: vi.fn(async () => { throw new Error('ECONNREFUSED'); }) });
        const h = mkHarness({ action: 'do_nothing' }, { api });

        const result = await tick(h);

        expect(result.skipped).toBe('context-fetch-failed');
        expect(h.audit.entries.at(-1).detail).toMatch(/ECONNREFUSED/);
    });

    it('an LLM outage is recorded AND still counts against the budget', async () => {
        const h = mkHarness(null, { decideThrows: '529 overloaded' });
        const result = await tick(h);

        expect(result.skipped).toBe('llm-call-failed');
        // A failed call still costs; not charging for it would let a failing
        // run retry against the cap forever.
        expect(h.budget.spentToday('agent-1').llmCalls).toBe(1);
    });

    it('notifications failing does not sink the whole tick', async () => {
        const api = mkApi({ fetchNotifications: vi.fn(async () => { throw new Error('boom'); }) });
        const h = mkHarness({ action: 'do_nothing' }, { api });
        expect((await tick(h)).skipped).toBeUndefined();
    });
});

describe('markAlreadyLiked', () => {
    it('flags only the cards this agent has liked', () => {
        const marked = markAlreadyLiked(FEED_CARDS, 'agent-1');
        expect(marked[0].likedByMe).toBe(false);
        expect(marked[1].likedByMe).toBe(true);
    });

    it('handles a missing likes array', () => {
        expect(markAlreadyLiked([{ _id: 'x' }], 'a')[0].likedByMe).toBe(false);
    });
});
