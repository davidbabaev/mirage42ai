// The inbound-DM reply path (master-plan §6).
//
// The headline case is the plan's own: the married persona receives an advance,
// declines in character, and REMEMBERS having done so — because an agent that
// forgets is freshly charmed by the same advance next week, which is the exact
// failure that makes it read as a machine.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { replyToDm, replyDelayMs, NOTICE_MIN_MS, NOTICE_MAX_MS } = requireFromHere('../src/dm/replyToDm.js');
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
        dailyBudget: { llmCalls: 40, actions: 20 },
        voice: 'Warm but economical.',
        enabled: true,
    },
};

const INBOUND = {
    _id: 'msg-1',
    conversationId: 'conv-1',
    userId: 'david-1',
    text: 'been thinking about you. let me take you to dinner?',
};

const mkApi = (over = {}) => ({
    fetchThread: vi.fn(async () => ({
        messages: [INBOUND],
        counterpartName: 'David Cohen',
    })),
    loadMemory: vi.fn(async () => ({ events: [], facts: [] })),
    writeMemory: vi.fn(async () => ({ ok: true })),
    ...over,
});

const mkHarness = (raw, { api, agent = AGENT, decideThrows, sendThrows } = {}) => {
    const budget = new BudgetLedger({ clock: () => AWAKE });
    const audit = new AuditTrail({ sink: { log: () => {} }, clock: () => 'T' });
    const chatSocket = {
        sendMessage: vi.fn(async () => {
            if (sendThrows) throw new Error(sendThrows);
            return { _id: 'sent-1' };
        }),
    };
    const decideImpl = decideThrows
        ? vi.fn(async () => { throw new Error(decideThrows); })
        : vi.fn(async () => ({ raw, usage: { input_tokens: 700, output_tokens: 30 } }));

    return { budget, audit, chatSocket, decideImpl, api: api || mkApi(), agent };
};

const run = (h, { message = INBOUND, now = AWAKE } = {}) => replyToDm({
    message, agent: h.agent, session: {}, chatSocket: h.chatSocket,
    llmClient: {}, budget: h.budget, audit: h.audit, now,
    random: () => 0.5,
    sleep: async () => {},           // no real waiting in tests
    api: h.api, decideImpl: h.decideImpl,
});

describe('THE HEADLINE CASE — married persona receives an advance', () => {
    const DECLINE = {
        reply: 'ah that is kind but no — very married! hope you are well though',
        fact: 'David asked me out to dinner; I told him I am married and declined.',
        reason: 'declined warmly, relationship rules',
    };

    it('replies in character rather than staying silent', async () => {
        const h = mkHarness(DECLINE);
        const result = await run(h);

        expect(result.replied).toBe(true);
        expect(h.chatSocket.sendMessage).toHaveBeenCalledWith({
            toUser: 'david-1',
            text: DECLINE.reply,
        });
    });

    it('RECORDS the decline as a durable fact about that person', async () => {
        const h = mkHarness(DECLINE);
        await run(h);

        const factWrite = h.api.writeMemory.mock.calls.find(
            ([, , payload]) => payload.facts?.length
        );
        expect(factWrite).toBeTruthy();
        const [, , payload] = factWrite;
        expect(payload.facts[0]).toEqual({
            userId: 'david-1',
            fact: DECLINE.fact,
        });
        expect(payload.facts[0].fact).toMatch(/married/i);
    });

    it('the prompt it was given carried the relationship rule and the memory', async () => {
        const api = mkApi({
            loadMemory: vi.fn(async () => ({
                events: [],
                facts: [{ userId: 'david-1', fact: 'David asked me out before; I said no.' }],
            })),
        });
        const h = mkHarness(DECLINE, { api });
        await run(h);

        const { systemPrompt } = h.decideImpl.mock.calls[0][0];
        expect(systemPrompt).toMatch(/NOT open to romantic/i);
        expect(systemPrompt).toMatch(/decline warmly/i);
        // The remembered history reached the model as settled fact.
        expect(systemPrompt).toContain('David asked me out before; I said no.');
        expect(systemPrompt).toMatch(/settled history/i);
        // And the DM-specific rules are there too.
        expect(systemPrompt).toMatch(/Never escalate romantically/i);
        expect(systemPrompt).toMatch(/asked to meet in person, say no/i);
    });

    it('records the inbound message as an event as well as the fact', async () => {
        const h = mkHarness(DECLINE);
        await run(h);

        const events = h.api.writeMemory.mock.calls.flatMap(([, , p]) => p.events || []);
        expect(events.some(e => e.type === 'dm_received')).toBe(true);
        expect(events.some(e => e.type === 'dm_sent')).toBe(true);
    });
});

describe('replying is optional — a real person does not always answer', () => {
    it('an empty reply sends nothing', async () => {
        const h = mkHarness({ reply: '', reason: 'not worth answering' });
        const result = await run(h);

        expect(result.replied).toBe(false);
        expect(result.skipped).toBe('chose-not-to-reply');
        expect(h.chatSocket.sendMessage).not.toHaveBeenCalled();
    });

    it('but still remembers what was said if a fact came back', async () => {
        const h = mkHarness({ reply: '', fact: 'He asked again after I said no.' });
        await run(h);

        const facts = h.api.writeMemory.mock.calls.flatMap(([, , p]) => p.facts || []);
        expect(facts[0].fact).toMatch(/asked again/);
    });

    it('a MALFORMED response says nothing rather than guessing', async () => {
        const h = mkHarness({ notAReply: true });
        const result = await run(h);

        expect(result.replied).toBe(false);
        expect(h.chatSocket.sendMessage).not.toHaveBeenCalled();
    });
});

describe('the human-feeling delay', () => {
    it('always waits at least §6\'s 30-second floor', () => {
        expect(replyDelayMs({ replyLength: 0, random: () => 0 })).toBeGreaterThanOrEqual(NOTICE_MIN_MS);
    });

    it('never exceeds the 15-minute ceiling for the notice component', () => {
        const longest = replyDelayMs({ replyLength: 0, random: () => 1, persona: { replyEagerness: 0 } });
        expect(longest).toBeLessThanOrEqual(NOTICE_MAX_MS);
    });

    it('scales with the length of what is being typed', () => {
        const short = replyDelayMs({ replyLength: 10, random: () => 0.5 });
        const long = replyDelayMs({ replyLength: 400, random: () => 0.5 });
        expect(long).toBeGreaterThan(short);
    });

    it('is NOT a constant — an identical pause every time is its own tell', () => {
        const delays = new Set(
            Array.from({ length: 20 }, (_, i) => replyDelayMs({ replyLength: 50, random: () => i / 20 }))
        );
        expect(delays.size).toBeGreaterThan(10);
    });

    it('an eager persona replies sooner than a slow one', () => {
        const eager = replyDelayMs({ replyLength: 0, random: () => 1, persona: { replyEagerness: 1 } });
        const slow = replyDelayMs({ replyLength: 0, random: () => 1, persona: { replyEagerness: 0 } });
        expect(eager).toBeLessThan(slow);
    });

    it('the agent actually WAITS before sending', async () => {
        const order = [];
        const h = mkHarness({ reply: 'sure' });
        h.chatSocket.sendMessage = vi.fn(async () => { order.push('sent'); });

        await replyToDm({
            message: INBOUND, agent: h.agent, session: {}, chatSocket: h.chatSocket,
            llmClient: {}, budget: h.budget, audit: h.audit, now: AWAKE,
            random: () => 0.5,
            sleep: async () => { order.push('waited'); },
            api: h.api, decideImpl: h.decideImpl,
        });

        expect(order).toEqual(['waited', 'sent']);
    });
});

describe('the gates', () => {
    it('never replies to its OWN message — the socket echoes both ways', async () => {
        const h = mkHarness({ reply: 'hi' });
        const result = await run(h, { message: { ...INBOUND, userId: 'agent-1' } });

        expect(result.skipped).toBe('own-message');
        expect(h.decideImpl).not.toHaveBeenCalled();
    });

    it('does not reply at 4am local — asleep means asleep', async () => {
        const h = mkHarness({ reply: 'hi' });
        const result = await run(h, { now: ASLEEP });

        expect(result.skipped).toBe('outside-active-hours');
        expect(h.decideImpl).not.toHaveBeenCalled();
        expect(h.chatSocket.sendMessage).not.toHaveBeenCalled();
    });

    it('respects the LLM budget cap BEFORE calling the model', async () => {
        const agent = { ...AGENT, persona: { ...AGENT.persona, dailyBudget: { llmCalls: 1, actions: 20 } } };
        const h = mkHarness({ reply: 'hi' }, { agent });

        await run(h);
        const second = await run(h);

        expect(second.skipped).toBe('llm-budget-exhausted');
        expect(h.decideImpl).toHaveBeenCalledTimes(1);
    });

    it('respects the ACTION cap — it may think but not send', async () => {
        const agent = { ...AGENT, persona: { ...AGENT.persona, dailyBudget: { llmCalls: 40, actions: 1 } } };
        const h = mkHarness({ reply: 'hi there' }, { agent });

        await run(h);
        const second = await run(h);

        expect(second.skipped).toBe('action-budget-exhausted');
        expect(h.chatSocket.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('a banned or disabled agent stays silent', async () => {
        const banned = mkHarness({ reply: 'hi' }, {
            agent: { ...AGENT, user: { ...AGENT.user, isBanned: true } },
        });
        expect((await run(banned)).skipped).toBe('account-banned');

        const off = mkHarness({ reply: 'hi' }, {
            agent: { ...AGENT, persona: { ...AGENT.persona, enabled: false } },
        });
        expect((await run(off)).skipped).toBe('persona-disabled');
    });
});

describe('failures are recorded, never silent', () => {
    it('a failed SEND does not record "I replied" in memory', async () => {
        // The send is ack'd, so a failure is real — not a silently buffered
        // message. Writing dm_sent here would be a lie in the agent's memory.
        const h = mkHarness({ reply: 'sure' }, { sendThrows: 'send timed out after 10000ms' });
        const result = await run(h);

        expect(result.skipped).toBe('send-failed');
        const events = h.api.writeMemory.mock.calls.flatMap(([, , p]) => p.events || []);
        expect(events.some(e => e.type === 'dm_sent')).toBe(false);
        expect(h.audit.entries.some(e => e.type === 'action' && e.ok === false)).toBe(true);
    });

    it('an LLM outage is recorded and still charged to the budget', async () => {
        const h = mkHarness(null, { decideThrows: '529 overloaded' });
        const result = await run(h);

        expect(result.skipped).toBe('llm-call-failed');
        expect(h.budget.spentToday('agent-1').llmCalls).toBe(1);
    });

    it('a failed context fetch skips with a reason', async () => {
        const api = mkApi({ fetchThread: vi.fn(async () => { throw new Error('ECONNREFUSED'); }) });
        const h = mkHarness({ reply: 'hi' }, { api });

        expect((await run(h)).skipped).toBe('dm-context-failed');
    });

    it('a memory-write failure does not stop the reply going out', async () => {
        const api = mkApi({ writeMemory: vi.fn(async () => { throw new Error('500'); }) });
        const h = mkHarness({ reply: 'sure', fact: 'x' }, { api });

        const result = await run(h);
        expect(result.replied).toBe(true);
        expect(h.audit.entries.some(e => e.type === 'memory_write_failed')).toBe(true);
    });
});

// The memory endpoints are ADMIN-guarded (`/agents/admin/:id/memory`). The
// worker holds two sessions on purpose: the agent's ordinary user token, and
// the admin runtime token. Handing the agent's token to a memory call returns
// 403 and kills every reply — which is exactly what shipped, because `api` is
// mocked here and no test ever looked at WHICH session it was given.
describe('the memory calls use the ADMIN runtime session, not the agent token', () => {
    const AGENT_SESSION = { id: 'agent-session' };
    const RUNTIME_SESSION = { id: 'runtime-session' };

    const runWithSessions = (h) => replyToDm({
        message: INBOUND, agent: h.agent,
        session: AGENT_SESSION,
        runtimeSession: RUNTIME_SESSION,
        chatSocket: h.chatSocket, llmClient: {},
        budget: h.budget, audit: h.audit, now: AWAKE,
        random: () => 0.5, sleep: async () => {},
        api: h.api, decideImpl: h.decideImpl,
    });

    it('loadMemory is called with the runtime session', async () => {
        const h = mkHarness({ reply: 'hi', fact: 'f' });
        await runWithSessions(h);

        expect(h.api.loadMemory).toHaveBeenCalled();
        expect(h.api.loadMemory.mock.calls[0][0]).toBe(RUNTIME_SESSION);
    });

    it('every writeMemory is called with the runtime session', async () => {
        const h = mkHarness({ reply: 'hi', fact: 'f' });
        await runWithSessions(h);

        expect(h.api.writeMemory).toHaveBeenCalled();
        for (const call of h.api.writeMemory.mock.calls) {
            expect(call[0]).toBe(RUNTIME_SESSION);
        }
    });

    it('the THREAD read still uses the agent own token — it is an ordinary user route', async () => {
        const h = mkHarness({ reply: 'hi' });
        await runWithSessions(h);

        expect(h.api.fetchThread.mock.calls[0][0]).toBe(AGENT_SESSION);
    });
});
