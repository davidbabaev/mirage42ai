// CONTRACT TEST on the REQUEST we send to Anthropic.
//
// REGRESSION: every real call failed with
//   400 invalid_request_error — output_config.format.name:
//   Extra inputs are not permitted
// because decide() sent `name: 'agent_decision'` inside output_config.format.
// That field does not exist.
//
// WHY THE SUITE MISSED IT: every test mocked the RESPONSE with a permissive
// fake that accepted any request object. A mock that always says yes cannot
// reject a malformed request, so the shape error was invisible until the first
// real call. Mocking the response proves what we do with an answer; it proves
// nothing about whether the question was legal.
//
// The fix here is not just "assert no name field" — it is to make the fake
// STRICT, so it rejects exactly what the real API rejects. The allowed key set
// is derived from the SDK's own zodOutputFormat() builder rather than from what
// I believe, so the test tracks the SDK instead of my memory of it.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { decide, DEFAULT_MODEL } = requireFromHere('../src/llm/decide.js');
const { DECISION_JSON_SCHEMA } = requireFromHere('../src/llm/decisionSchema.js');
const { zodOutputFormat } = requireFromHere('@anthropic-ai/sdk/helpers/zod');
const { z } = requireFromHere('zod');

/**
 * The wire fields JSONOutputFormat actually has, taken from the SDK's own
 * builder. Function-valued keys (zodOutputFormat attaches a client-side
 * `parse`) are dropped — JSON.stringify strips them, so they never hit the
 * wire. Currently resolves to ['type','schema'], matching
 * `interface JSONOutputFormat` in @anthropic-ai/sdk messages.d.ts.
 */
const SDK_FORMAT_WIRE_KEYS = Object.entries(
    zodOutputFormat(z.object({ probe: z.string() }))
).filter(([, v]) => typeof v !== 'function').map(([k]) => k).sort();

/** Top-level Messages API params this worker is allowed to send. */
const ALLOWED_TOP_LEVEL = ['model', 'max_tokens', 'system', 'messages', 'output_config'];

/**
 * A fake client that behaves like the real API's validator: it REJECTS unknown
 * fields instead of silently accepting them. This is the mock the suite should
 * have had from the start.
 */
const strictFakeAnthropic = (payload = { action: 'do_nothing', reason: 'ok' }) => {
    const create = vi.fn(async (req) => {
        const reject = (path) => {
            const err = new Error(
                `400 invalid_request_error — ${path}: Extra inputs are not permitted`
            );
            err.status = 400;
            throw err;
        };

        for (const key of Object.keys(req)) {
            if (!ALLOWED_TOP_LEVEL.includes(key)) reject(key);
        }
        const format = req.output_config?.format;
        if (format) {
            for (const key of Object.keys(format)) {
                if (!SDK_FORMAT_WIRE_KEYS.includes(key)) reject(`output_config.format.${key}`);
            }
            if (format.type !== 'json_schema') reject('output_config.format.type');
        }

        return {
            content: [{ type: 'text', text: JSON.stringify(payload) }],
            usage: { input_tokens: 100, output_tokens: 20 },
            stop_reason: 'end_turn',
        };
    });
    return { messages: { create } };
};

describe('the SDK contract we are coding against', () => {
    it('JSONOutputFormat has exactly type + schema — and no name', () => {
        expect(SDK_FORMAT_WIRE_KEYS).toEqual(['schema', 'type']);
        expect(SDK_FORMAT_WIRE_KEYS).not.toContain('name');
    });
});

describe('decide() — the request body it builds', () => {
    const capture = async () => {
        const client = strictFakeAnthropic();
        await decide({ client, systemPrompt: 'p', feed: [] });
        return client.messages.create.mock.calls[0][0];
    };

    it('is ACCEPTED by a validator that enforces the real API contract', async () => {
        // The whole regression in one assertion: this rejected the old body.
        await expect(
            decide({ client: strictFakeAnthropic(), systemPrompt: 'p' })
        ).resolves.toBeTruthy();
    });

    it('sends output_config.format with EXACTLY the SDK wire fields', async () => {
        const req = await capture();
        expect(Object.keys(req.output_config.format).sort()).toEqual(SDK_FORMAT_WIRE_KEYS);
    });

    it('does NOT send a name field (the exact 400 that shipped)', async () => {
        const req = await capture();
        expect(req.output_config.format).not.toHaveProperty('name');
    });

    it('sends type: json_schema', async () => {
        const req = await capture();
        expect(req.output_config.format.type).toBe('json_schema');
    });

    it('sends no unexpected TOP-LEVEL params either', async () => {
        const req = await capture();
        for (const key of Object.keys(req)) {
            expect(ALLOWED_TOP_LEVEL, `unexpected top-level param: ${key}`).toContain(key);
        }
    });

    it('sends no sampling params or thinking config', async () => {
        const req = await capture();
        for (const banned of ['temperature', 'top_p', 'top_k', 'thinking']) {
            expect(req[banned], `${banned} must not be sent`).toBeUndefined();
        }
    });

    it('targets the Haiku-class model', async () => {
        const req = await capture();
        expect(req.model).toBe(DEFAULT_MODEL);
        expect(req.model).toMatch(/haiku/);
    });
});

describe('the decision schema stays inside the structured-outputs subset', () => {
    // A schema keyword the API does not support is the OTHER way this 400s.
    // Walk the whole tree rather than eyeballing the top level.
    const walk = (node, visit, path = '$') => {
        if (Array.isArray(node)) {
            node.forEach((n, i) => walk(n, visit, `${path}[${i}]`));
            return;
        }
        if (node && typeof node === 'object') {
            visit(node, path);
            for (const [k, v] of Object.entries(node)) walk(v, visit, `${path}.${k}`);
        }
    };

    it('uses no unsupported constraint keywords anywhere', () => {
        const UNSUPPORTED = [
            'minLength', 'maxLength',            // string constraints
            'minimum', 'maximum', 'multipleOf',  // numeric constraints
            'minItems', 'maxItems', 'uniqueItems',
            'patternProperties', 'dependencies',
        ];
        walk(DECISION_JSON_SCHEMA, (obj, path) => {
            for (const kw of UNSUPPORTED) {
                expect(obj, `${path} carries unsupported keyword "${kw}"`).not.toHaveProperty(kw);
            }
        });
    });

    it('sets additionalProperties:false on every object (required)', () => {
        walk(DECISION_JSON_SCHEMA, (obj, path) => {
            if (obj.type === 'object') {
                expect(obj.additionalProperties, `${path} must set additionalProperties:false`)
                    .toBe(false);
            }
        });
    });

    it('is not recursive', () => {
        expect(JSON.stringify(DECISION_JSON_SCHEMA)).not.toContain('$ref');
    });
});

describe('the strict fake still exercises the real parsing path', () => {
    it('a valid structured response still validates against zod', async () => {
        const client = strictFakeAnthropic({
            action: 'post', text: 'the sea was flat today', reason: 'ran this morning',
        });
        const result = await decide({ client, systemPrompt: 'p' });

        expect(result.valid).toBe(true);
        expect(result.decision.action).toBe('post');
    });

    it('a malformed response still degrades to do_nothing', async () => {
        const client = strictFakeAnthropic({ action: 'comment', cardId: 'c1' }); // no text
        const result = await decide({ client, systemPrompt: 'p' });

        expect(result.valid).toBe(false);
        expect(result.decision.action).toBe('do_nothing');
    });
});
