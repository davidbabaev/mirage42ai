// The one LLM call per heartbeat, and the schema that guards what comes back.
//
// The Anthropic client is INJECTED and always fake here — the suite must never
// hit the real API (cost, flakiness, and a test that depends on a live model's
// judgement is not a test). What is verified is the request shape and, more
// importantly, that a bad response can never cause an action.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { decide, buildUserMessage, summariseFeed, DEFAULT_MODEL } = requireFromHere('../src/llm/decide.js');
const {
    parseDecision, DECISION_JSON_SCHEMA, ACTIONS, MAX_COMMENT,
} = requireFromHere('../src/llm/decisionSchema.js');

const fakeClient = (payload, extra = {}) => ({
    messages: {
        create: vi.fn(async () => ({
            content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }],
            usage: { input_tokens: 100, output_tokens: 20 },
            stop_reason: 'end_turn',
            ...extra,
        })),
    },
});

const FEED = [
    {
        _id: 'card-1',
        content: 'made bread again',
        creator: { name: 'dana', lastName: 'levi' },
        likes: ['u1', 'u2'],
        comments: [{}],
    },
];

describe('decisionSchema — the shape we act on', () => {
    it('accepts each valid action', () => {
        expect(parseDecision({ action: 'do_nothing' }).ok).toBe(true);
        expect(parseDecision({ action: 'like', cardId: 'c1' }).ok).toBe(true);
        expect(parseDecision({ action: 'comment', cardId: 'c1', text: 'nice' }).ok).toBe(true);
        expect(parseDecision({ action: 'post', text: 'hello world' }).ok).toBe(true);
    });

    it('makes malformed combinations unrepresentable', () => {
        // like with no cardId — nothing to like
        expect(parseDecision({ action: 'like' }).ok).toBe(false);
        // comment with no text — nothing to say
        expect(parseDecision({ action: 'comment', cardId: 'c1' }).ok).toBe(false);
        // post with no text
        expect(parseDecision({ action: 'post' }).ok).toBe(false);
        // an action we do not implement
        expect(parseDecision({ action: 'follow', userId: 'u1' }).ok).toBe(false);
    });

    it.each([null, undefined, 'a string', 42, {}, []])(
        'falls back to do_nothing for junk input: %s',
        (junk) => {
            const result = parseDecision(junk);
            expect(result.ok).toBe(false);
            expect(result.decision.action).toBe('do_nothing');
        }
    );

    it('NEVER throws — a malformed decision must not crash the worker', () => {
        expect(() => parseDecision(Symbol('nope'))).not.toThrow();
    });

    it('bounds comment length so a runaway generation is caught', () => {
        const tooLong = { action: 'comment', cardId: 'c1', text: 'x'.repeat(MAX_COMMENT + 1) };
        expect(parseDecision(tooLong).ok).toBe(false);
    });

    it('the JSON schema and the zod schema agree on the action set', () => {
        expect(DECISION_JSON_SCHEMA.properties.action.enum).toEqual(ACTIONS);
        for (const action of ACTIONS) {
            const probe = { action, cardId: 'c1', text: 'some text' };
            expect(parseDecision(probe).ok, `${action} should validate`).toBe(true);
        }
    });
});

describe('decide — the request it sends', () => {
    it('uses the cheap Haiku-class model and asks for a structured decision', async () => {
        const client = fakeClient({ action: 'do_nothing', reason: 'nothing worth reacting to' });

        await decide({ client, systemPrompt: 'you are maya', feed: FEED });

        const args = client.messages.create.mock.calls[0][0];
        expect(args.model).toBe(DEFAULT_MODEL);
        expect(DEFAULT_MODEL).toMatch(/haiku/);
        expect(args.system).toBe('you are maya');
        expect(args.output_config.format.type).toBe('json_schema');
        expect(args.output_config.format.schema).toBe(DECISION_JSON_SCHEMA);
    });

    it('makes exactly ONE call per decision — the daily budget assumes it', async () => {
        const client = fakeClient({ action: 'do_nothing' });
        await decide({ client, systemPrompt: 'p', feed: FEED });
        expect(client.messages.create).toHaveBeenCalledTimes(1);
    });

    it('does not request extended thinking on a cheap per-tick call', async () => {
        const client = fakeClient({ action: 'do_nothing' });
        await decide({ client, systemPrompt: 'p' });
        expect(client.messages.create.mock.calls[0][0].thinking).toBeUndefined();
    });

    it('requires a client and a system prompt', async () => {
        await expect(decide({ systemPrompt: 'p' })).rejects.toThrow(/client is required/);
        await expect(decide({ client: fakeClient({}) })).rejects.toThrow(/systemPrompt is required/);
    });
});

describe('decide — what it returns', () => {
    it('returns a valid decision as-is', async () => {
        const client = fakeClient({ action: 'post', text: 'the sea was flat today', reason: 'ran this morning' });
        const result = await decide({ client, systemPrompt: 'p' });

        expect(result.valid).toBe(true);
        expect(result.decision).toEqual({
            action: 'post', text: 'the sea was flat today', reason: 'ran this morning',
        });
        expect(result.usage.output_tokens).toBe(20);
    });

    it('degrades a MALFORMED response to do_nothing instead of acting on it', async () => {
        const client = fakeClient({ action: 'comment', cardId: 'c1' }); // no text
        const result = await decide({ client, systemPrompt: 'p' });

        expect(result.valid).toBe(false);
        expect(result.decision.action).toBe('do_nothing');
        expect(result.error).toMatch(/text/);
    });

    it('degrades NON-JSON output to do_nothing', async () => {
        const client = fakeClient('I think you should probably post something!');
        const result = await decide({ client, systemPrompt: 'p' });
        expect(result.decision.action).toBe('do_nothing');
    });

    it('treats a refusal as do_nothing and records it', async () => {
        const client = fakeClient({}, { stop_reason: 'refusal', content: [] });
        const result = await decide({ client, systemPrompt: 'p' });

        expect(result.refused).toBe(true);
        expect(result.decision.action).toBe('do_nothing');
    });

    it('lets a TRANSPORT failure through — an outage must not look like a quiet tick', async () => {
        const client = { messages: { create: vi.fn(async () => { throw new Error('529 overloaded'); }) } };
        await expect(decide({ client, systemPrompt: 'p' })).rejects.toThrow(/529/);
    });
});

describe('decide — the context it sends', () => {
    it('summarises the feed to ids, authors and text — not raw documents', () => {
        const summary = summariseFeed(FEED);
        expect(summary[0]).toMatchObject({
            cardId: 'card-1', author: 'dana levi', likes: 2, comments: 1,
        });
        // No raw mongo fields leak into the prompt (tokens cost money).
        expect(JSON.stringify(summary)).not.toContain('__v');
        expect(JSON.stringify(summary)).not.toContain('userId');
    });

    it('truncates a very long post so one card cannot dominate the prompt', () => {
        const summary = summariseFeed([{ _id: 'x', content: 'y'.repeat(5000) }]);
        expect(summary[0].text.length).toBeLessThanOrEqual(400);
    });

    it('caps how many cards are described', () => {
        const many = Array.from({ length: 50 }, (_, i) => ({ _id: `c${i}`, content: 'x' }));
        expect(summariseFeed(many).length).toBeLessThanOrEqual(12);
    });

    it('says the feed is empty rather than sending an empty array', () => {
        expect(buildUserMessage({ feed: [] })).toMatch(/feed is empty/i);
    });

    it('offers do_nothing first and calls it the usual answer', () => {
        const msg = buildUserMessage({ feed: FEED });
        expect(msg).toMatch(/do_nothing\s+\(usually the right answer\)/);
    });
});
