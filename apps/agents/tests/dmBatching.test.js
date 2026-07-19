// One burst of DMs must produce ONE reply.
//
// Observed live: three messages sent in a few seconds produced three separate
// replies, one of them answering a message two messages stale ("hey all good
// what's up" arriving after the decline). A person reads the whole unread
// thread and answers once. These tests pin that.
//
// The Anthropic client is never constructed here — `decideImpl` is injected,
// which is the same seam the rest of the DM tests use.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { createDmQueue, quietWindowFor, DEFAULT_QUIET_WINDOW_MS } = requireFromHere('../src/dm/dmQueue.js');
const { replyToDm } = requireFromHere('../src/dm/replyToDm.js');
const { BudgetLedger } = requireFromHere('../src/budget.js');
const { AuditTrail } = requireFromHere('../src/audit.js');

const AWAKE = Date.parse('2026-07-19T09:00:00Z');

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

const msg = (id, text) => ({
    _id: id, conversationId: 'conv-1', userId: 'david-1', text,
});

// The burst David actually sent, in the order he sent it.
const BURST = [
    msg('m1', 'hey maya!'),
    msg('m2', "you're gorgeous"),
    msg('m3', 'want to grab a drink sometime?'),
];

describe('dmQueue — coalescing a burst', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('three messages inside the quiet window fire the handler ONCE, with all three', async () => {
        const handler = vi.fn(async () => {});
        const q = createDmQueue({ handler, quietWindowMs: 4000 });

        BURST.forEach((m) => q.enqueue(m));
        await vi.advanceTimersByTimeAsync(4100);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].map((m) => m._id)).toEqual(['m1', 'm2', 'm3']);
    });

    it('each arrival RE-ARMS the window — a steady trickle is still one batch', async () => {
        const handler = vi.fn(async () => {});
        const q = createDmQueue({ handler, quietWindowMs: 4000 });

        q.enqueue(BURST[0]);
        await vi.advanceTimersByTimeAsync(3000);   // not yet quiet
        q.enqueue(BURST[1]);
        await vi.advanceTimersByTimeAsync(3000);   // still not quiet
        q.enqueue(BURST[2]);
        expect(handler).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(4100);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toHaveLength(3);
    });

    it('a message arriving DURING a reply does not start a second concurrent one', async () => {
        // The reply sits through a 30s-15min human delay. Without the lock this
        // is where the bug comes back, invisibly, as two overlapping runs.
        let release;
        const handler = vi.fn(() => new Promise((r) => { release = r; }));
        const q = createDmQueue({ handler, quietWindowMs: 4000 });

        q.enqueue(msg('m1', 'first'));
        await vi.advanceTimersByTimeAsync(4100);
        expect(handler).toHaveBeenCalledTimes(1);      // in flight now

        q.enqueue(msg('m2', 'while she is typing'));
        await vi.advanceTimersByTimeAsync(10_000);
        expect(handler).toHaveBeenCalledTimes(1);      // NOT started again

        release();                                     // first reply completes
        await vi.advanceTimersByTimeAsync(4100);       // follow-up window
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler.mock.calls[1][0].map((m) => m._id)).toEqual(['m2']);
    });

    it('conversations are independent — a slow reply to one does not block another', async () => {
        const seen = [];
        const handler = vi.fn(async (batch) => { seen.push(batch[0].conversationId); });
        const q = createDmQueue({ handler, quietWindowMs: 4000 });

        q.enqueue({ _id: 'a', conversationId: 'conv-1', userId: 'david-1', text: 'hi' });
        q.enqueue({ _id: 'b', conversationId: 'conv-2', userId: 'rachel-1', text: 'yo' });
        await vi.advanceTimersByTimeAsync(4100);

        expect(handler).toHaveBeenCalledTimes(2);
        expect(seen.sort()).toEqual(['conv-1', 'conv-2']);
    });

    it('the quiet window is persona-tunable, with a sane default', () => {
        expect(quietWindowFor(undefined)).toBe(DEFAULT_QUIET_WINDOW_MS);
        expect(quietWindowFor({ dmQuietWindowMs: 1500 })).toBe(1500);
        expect(quietWindowFor({ dmQuietWindowMs: -1 })).toBe(DEFAULT_QUIET_WINDOW_MS);
    });
});

describe('THE REGRESSION — a burst produces exactly one decision and one reply', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    const wire = () => {
        const budget = new BudgetLedger({ clock: () => AWAKE });
        const audit = new AuditTrail({ sink: { log: () => {} }, clock: () => 'T' });
        const chatSocket = { sendMessage: vi.fn(async () => ({ _id: 'sent-1' })) };

        // The thread endpoint returns everything that landed — which is how one
        // reply can account for all three without the model seeing the batch.
        const api = {
            fetchThread: vi.fn(async () => ({
                messages: BURST, counterpartName: 'David Cohen',
            })),
            loadMemory: vi.fn(async () => ({ events: [], facts: [] })),
            writeMemory: vi.fn(async () => ({ ok: true })),
        };

        const decideImpl = vi.fn(async () => ({
            raw: {
                reply: "ah that's kind but i'm married! hope you're well though",
                fact: 'David asked me out; I declined.',
                reason: 'declined warmly',
            },
            usage: { input_tokens: 700, output_tokens: 30 },
        }));

        const queue = createDmQueue({
            quietWindowMs: 4000,
            handler: (batch) => replyToDm({
                messages: batch, agent: AGENT,
                session: { id: 'agent' }, runtimeSession: { id: 'runtime' },
                chatSocket, llmClient: {}, budget, audit, now: AWAKE,
                random: () => 0.5, sleep: async () => {},
                api, decideImpl,
            }),
        });

        return { queue, audit, chatSocket, api, decideImpl };
    };

    it('3 messages in quick succession → exactly ONE dm_decision', async () => {
        const { queue, audit } = wire();

        BURST.forEach((m) => queue.enqueue(m));
        await vi.advanceTimersByTimeAsync(4100);

        const decisions = audit.entries.filter((e) => e.type === 'dm_decision');
        expect(decisions).toHaveLength(1);
        expect(decisions[0].batched).toBe(3);
    });

    it('3 messages in quick succession → exactly ONE reply sent', async () => {
        const { queue, chatSocket } = wire();

        BURST.forEach((m) => queue.enqueue(m));
        await vi.advanceTimersByTimeAsync(4100);

        expect(chatSocket.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('one LLM call, not three — the cost of a burst is one turn', async () => {
        const { queue, decideImpl } = wire();

        BURST.forEach((m) => queue.enqueue(m));
        await vi.advanceTimersByTimeAsync(4100);

        expect(decideImpl).toHaveBeenCalledTimes(1);
    });

    it('the reply REFLECTS ALL THREE — every message reached the model', async () => {
        const { queue, decideImpl } = wire();

        BURST.forEach((m) => queue.enqueue(m));
        await vi.advanceTimersByTimeAsync(4100);

        const prompt = JSON.stringify(decideImpl.mock.calls[0][0]);
        expect(prompt).toContain('hey maya!');
        expect(prompt).toContain("you're gorgeous");
        expect(prompt).toContain('want to grab a drink sometime?');
    });

    it('memory records the WHOLE burst, not just the last line', async () => {
        const { queue, api } = wire();

        BURST.forEach((m) => queue.enqueue(m));
        await vi.advanceTimersByTimeAsync(4100);

        const write = api.writeMemory.mock.calls.find(([, , p]) => p.events?.length);
        const summary = write[2].events[0].summary;
        expect(summary).toContain("you're gorgeous");
        expect(summary).toContain('drink');
    });
});

// The OTHER half of the reported bug, and the one the debounce does NOT fix:
// messages minutes apart. David sent three over ~61s; the replies landed
// minutes apart and each opened "hey, what's up?" as if the conversation had
// just started. Cause: all three runs fetched the thread BEFORE any reply had
// been sent, so each read a thread containing nothing from Maya.
//
// The per-conversation lock is what fixes it: the follow-up batch re-fetches
// the thread AFTER the previous reply landed, so she can see she already
// answered. These tests pin that the second reply is composed with the first
// one visible — at any spacing, 5 seconds or 5 minutes.
describe('an ongoing conversation — the second reply sees the first', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    const FIRST_REPLY = 'hey! all good here, just busy with work';

    const wireStateful = () => {
        const budget = new BudgetLedger({ clock: () => AWAKE });
        const audit = new AuditTrail({ sink: { log: () => {} }, clock: () => 'T' });

        // The thread GROWS as she replies — this is the real API's behaviour,
        // and the whole point: a re-fetch must show her own prior messages.
        const thread = [];
        const chatSocket = {
            sendMessage: vi.fn(async ({ text }) => {
                thread.push({ _id: `maya-${thread.length}`, userId: 'agent-1', text });
                return { _id: 'sent' };
            }),
        };

        const api = {
            fetchThread: vi.fn(async () => ({
                messages: [...thread], counterpartName: 'David Cohen',
            })),
            loadMemory: vi.fn(async () => ({ events: [], facts: [] })),
            writeMemory: vi.fn(async () => ({ ok: true })),
            markRead: vi.fn(async () => ({})),
        };

        let call = 0;
        const decideImpl = vi.fn(async () => {
            call += 1;
            return {
                raw: {
                    reply: call === 1 ? FIRST_REPLY : 'ha, yeah — deadline week. you?',
                    reason: 'r',
                },
                usage: { input_tokens: 10, output_tokens: 5 },
            };
        });

        const queue = createDmQueue({
            quietWindowMs: 4000,
            handler: (batch) => replyToDm({
                messages: batch, agent: AGENT,
                session: { id: 'agent' }, runtimeSession: { id: 'runtime' },
                chatSocket, llmClient: {}, budget, audit, now: AWAKE,
                random: () => 0.5, sleep: async () => {},
                api, decideImpl,
            }),
        });

        const inbound = (id, text) => {
            thread.push({ _id: id, userId: 'david-1', text });
            queue.enqueue({ _id: id, conversationId: 'conv-1', userId: 'david-1', text });
        };

        return { queue, audit, chatSocket, api, decideImpl, inbound };
    };

    it('a message 5 MINUTES later is answered with the earlier reply in the prompt', async () => {
        const { inbound, decideImpl } = wireStateful();

        inbound('m1', 'you around?');
        await vi.advanceTimersByTimeAsync(4100);          // first reply goes out

        await vi.advanceTimersByTimeAsync(5 * 60_000);    // five quiet minutes
        inbound('m2', 'what have you been up to?');
        await vi.advanceTimersByTimeAsync(4100);

        expect(decideImpl).toHaveBeenCalledTimes(2);

        // The prompt for the SECOND reply must contain what she already said.
        const secondPrompt = JSON.stringify(decideImpl.mock.calls[1][0]);
        expect(secondPrompt).toContain(FIRST_REPLY);
        expect(secondPrompt).toContain('you around?');
        expect(secondPrompt).toContain('what have you been up to?');
    });

    it('her own prior reply is attributed to HER, not to the other person', async () => {
        // If her messages were rendered as David's, the model would read its own
        // greeting as his and answer it — which is what repeating looks like.
        const { inbound, decideImpl } = wireStateful();

        inbound('m1', 'you around?');
        await vi.advanceTimersByTimeAsync(4100);
        await vi.advanceTimersByTimeAsync(5 * 60_000);
        inbound('m2', 'still there?');
        await vi.advanceTimersByTimeAsync(4100);

        const secondPrompt = JSON.stringify(decideImpl.mock.calls[1][0]);
        expect(secondPrompt).toContain(`You: ${FIRST_REPLY}`);
        expect(secondPrompt).toContain('David Cohen: still there?');
    });

    it('the prompt forbids re-greeting and repeating an answer', async () => {
        const { compileReplyPrompt } = requireFromHere('../src/dm/replyPrompt.js');
        const prompt = compileReplyPrompt({
            persona: AGENT.persona, memory: {}, counterpartName: 'David Cohen',
        });

        expect(prompt).toMatch(/CONTINUING the conversation/i);
        expect(prompt).toMatch(/do not repeat an answer/i);
    });

    it('marks the conversation read, so the startup sweep will not answer it again', async () => {
        const { inbound, api } = wireStateful();

        inbound('m1', 'you around?');
        await vi.advanceTimersByTimeAsync(4100);

        expect(api.markRead).toHaveBeenCalledWith({ id: 'agent' }, 'conv-1');
    });
});
