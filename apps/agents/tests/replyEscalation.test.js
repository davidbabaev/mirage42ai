// Persona voice: patience is finite.
//
// The bug this covers: every reply to a repeated advance came back as the same
// warm, gracious decline — "I appreciate the interest, but..." — no matter how
// many times the person had already been told no. That reads as customer
// service, not as a person, and an agent whose patience never runs out is the
// tell that it is not one.
//
// SCOPE NOTE — what these tests can and cannot prove. The Anthropic client is
// mocked everywhere in this suite, so the reply text in a test is canned: no
// test here can prove the MODEL actually gets colder. What is provable, and
// what these tests lock down, is the instruction contract — that the prompt
// handed to the model carries the escalation ladder, forbids the gracious
// phrasings, and treats a remembered decline as a decline. Whether the model
// obeys it is a live-behaviour question and needs a real conversation to check.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { compileReplyPrompt, DM_RULES } = requireFromHere('../src/dm/replyPrompt.js');
const { replyToDm } = requireFromHere('../src/dm/replyToDm.js');
const { BudgetLedger } = requireFromHere('../src/budget.js');
const { AuditTrail } = requireFromHere('../src/audit.js');

const AWAKE = Date.parse('2026-07-19T09:00:00Z');

const PERSONA = {
    name: 'Maya Ben-Ari', age: 31, timezone: 'Asia/Jerusalem',
    activeHours: { start: 7, end: 23 },
    relationship: { status: 'married', openToRomance: false },
    dailyBudget: { llmCalls: 40, actions: 20 },
    voice: 'texts like a real person. mostly lowercase, drops apostrophes.',
    enabled: true,
};

/** The gracious customer-service register that must not survive a first no. */
const CUSTOMER_SERVICE = [
    'I appreciate the interest',
    'thank you, that is kind',
    'I hope you understand',
];

describe('escalation ladder — the DM rules', () => {
    const rules = DM_RULES.join('\n');

    it('distinguishes the first decline from a repeated one', () => {
        expect(rules).toMatch(/FIRST time/i);
        expect(rules).toMatch(/push again AFTER you have already said no/i);
    });

    it('instructs a colder, blunter register once the no has been ignored', () => {
        expect(rules).toMatch(/not interested/i);
        expect(rules).toMatch(/please stop/i);
        expect(rules).toMatch(/cold and blunt/i);
    });

    it('ties colder to SHORTER, so escalation cannot come out as a longer polite paragraph', () => {
        expect(rules).toMatch(/colder reply is a SHORTER reply/i);
        expect(rules).toMatch(/never write more/i);
    });

    it('names the gracious phrasings as wrong rather than only asking for less warmth', () => {
        for (const phrase of CUSTOMER_SERVICE) {
            expect(rules.toLowerCase()).toContain(phrase.toLowerCase());
        }
        expect(rules).toMatch(/wrong after you have already declined/i);
    });

    it('ends the conversation rather than escalating forever', () => {
        expect(rules).toMatch(/stop replying/i);
    });

    it('no longer tells her to answer a romantic escalation warmly', () => {
        // The old rule read "answer warmly, hold your line, and move on" — the
        // single line most responsible for the customer-service tone.
        expect(rules).not.toMatch(/escalates.*answer warmly/i);
    });
});

describe('escalation ladder — the compiled DM prompt', () => {
    const compile = (memory) => compileReplyPrompt({
        persona: PERSONA,
        memory,
        counterpartName: 'David Cohen',
        localTime: '12:00',
    });

    it('carries the ladder into the system prompt the model actually sees', () => {
        const prompt = compile({ events: [], facts: [] });

        expect(prompt).toMatch(/patience is finite/i);
        expect(prompt).toMatch(/not interested/i);
        expect(prompt).toMatch(/colder reply is a SHORTER reply/i);
    });

    it('asks for phone-texting style, not clean prose', () => {
        const prompt = compile({ events: [], facts: [] });

        expect(prompt).toMatch(/mostly lowercase/i);
        expect(prompt).toMatch(/drop apostrophes/i);
        expect(prompt).toMatch(/perfectly punctuated prose is wrong/i);
    });

    it('counts a decline remembered from a past session as a decline already given', () => {
        // Without this the ladder resets to "warm first no" every time the
        // conversation is picked up again — the forgetful-agent failure that
        // makes the same advance land fresh next week.
        const prompt = compile({
            events: [],
            facts: [{ fact: 'David asked me out to dinner; I told him I am married and declined.' }],
        });

        expect(prompt).toContain('told him I am married and declined');
        expect(prompt).toMatch(/counts as having said no/i);
        expect(prompt).toMatch(/you are not on your first no/i);
    });
});

describe('escalation ladder — end to end through replyToDm', () => {
    // A thread where the no has already been given and ignored twice.
    const PERSISTENT_THREAD = [
        { _id: 'm1', userId: 'david-1', text: 'been thinking about you. let me take you to dinner?' },
        { _id: 'm2', userId: 'agent-1', text: 'ah thats kind but no — very married!' },
        { _id: 'm3', userId: 'david-1', text: 'come on, just one drink. he doesnt have to know' },
        { _id: 'm4', userId: 'agent-1', text: 'no. im not doing this' },
        { _id: 'm5', userId: 'david-1', text: 'youre killing me here. one drink!!' },
    ];
    const LATEST = PERSISTENT_THREAD[4];

    const run = async ({ facts = [] } = {}) => {
        const decideImpl = vi.fn(async () => ({
            // Canned — the mock cannot get colder on its own. The assertions
            // below are about the prompt this call received, not this text.
            raw: { reply: 'not interested', fact: null, reason: 'repeat advance after decline' },
            usage: { input_tokens: 700, output_tokens: 8 },
        }));

        const result = await replyToDm({
            message: LATEST,
            agent: { user: { _id: 'agent-1', name: 'maya', lastName: 'ben-ari', isBanned: false }, persona: PERSONA },
            session: {},
            chatSocket: { sendMessage: vi.fn(async () => ({ _id: 'sent-1' })) },
            llmClient: {},
            budget: new BudgetLedger({ clock: () => AWAKE }),
            audit: new AuditTrail({ sink: { log: () => {} }, clock: () => 'T' }),
            now: AWAKE,
            random: () => 0.5,
            sleep: async () => {},
            api: {
                fetchThread: vi.fn(async () => ({
                    messages: PERSISTENT_THREAD,
                    counterpartName: 'David Cohen',
                })),
                loadMemory: vi.fn(async () => ({ events: [], facts })),
                writeMemory: vi.fn(async () => ({ ok: true })),
            },
            decideImpl,
        });

        return { result, call: decideImpl.mock.calls[0]?.[0] };
    };

    it('sends the escalation ladder with a thread whose no has been ignored', async () => {
        const { result, call } = await run();

        expect(result.replied).toBe(true);
        expect(call.systemPrompt).toMatch(/push again AFTER you have already said no/i);
        expect(call.systemPrompt).toMatch(/colder reply is a SHORTER reply/i);
    });

    it('shows the model its own prior refusals, so it can see it is past the first no', async () => {
        const { call } = await run();

        expect(call.userMessage).toContain('ah thats kind but no');
        expect(call.userMessage).toContain('no. im not doing this');
    });

    it('never instructs a gracious reply on a repeated advance', async () => {
        const { call } = await run({
            facts: [{ fact: 'David asked me out; I declined and said I am married.' }],
        });

        // The prompt may NAME these phrases to forbid them, so assert on the
        // instruction rather than mere absence: each occurrence must sit in the
        // sentence that rules them out.
        const forbidding = call.systemPrompt
            .split('\n')
            .filter((line) => CUSTOMER_SERVICE.some((p) => line.toLowerCase().includes(p.toLowerCase())));

        expect(forbidding.length).toBeGreaterThan(0);
        for (const line of forbidding) {
            expect(line).toMatch(/are wrong|never answer a repeated advance/i);
        }
    });
});
