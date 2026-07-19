// CONTRACT TEST on the DM reply request.
//
// F3 shipped an invented `output_config.format.name` and every real call 400d,
// because the mocks were permissive — a fake that accepts anything cannot
// reject a malformed request. The DM path makes the SAME call shape, so it gets
// the same strict fake rather than trusting that I remembered the lesson.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { replyToMessage } = requireFromHere('../src/llm/reply.js');
const { REPLY_JSON_SCHEMA, parseReply } = requireFromHere('../src/llm/replySchema.js');
const { zodOutputFormat } = requireFromHere('@anthropic-ai/sdk/helpers/zod');
const { z } = requireFromHere('zod');

/** Wire fields JSONOutputFormat actually has, per the SDK's own builder. */
const SDK_FORMAT_WIRE_KEYS = Object.entries(
    zodOutputFormat(z.object({ probe: z.string() }))
).filter(([, v]) => typeof v !== 'function').map(([k]) => k).sort();

const ALLOWED_TOP_LEVEL = ['model', 'max_tokens', 'system', 'messages', 'output_config'];

/** Rejects unknown fields exactly as the real API does. */
const strictFake = (payload = { reply: 'ok' }) => ({
    messages: {
        create: vi.fn(async (req) => {
            const reject = (path) => {
                const err = new Error(`400 invalid_request_error — ${path}: Extra inputs are not permitted`);
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
            }
            return {
                content: [{ type: 'text', text: JSON.stringify(payload) }],
                usage: { input_tokens: 700, output_tokens: 30 },
                stop_reason: 'end_turn',
            };
        }),
    },
});

const call = async (client = strictFake()) => {
    await replyToMessage({ client, systemPrompt: 'you are maya', userMessage: 'David: hi' });
    return client.messages.create.mock.calls[0][0];
};

describe('the DM reply request', () => {
    it('is ACCEPTED by a validator enforcing the real API contract', async () => {
        await expect(
            replyToMessage({ client: strictFake(), systemPrompt: 'p', userMessage: 'm' })
        ).resolves.toBeTruthy();
    });

    it('sends output_config.format with EXACTLY the SDK wire fields', async () => {
        const req = await call();
        expect(Object.keys(req.output_config.format).sort()).toEqual(SDK_FORMAT_WIRE_KEYS);
    });

    it('does NOT send a name field (the F3 400)', async () => {
        const req = await call();
        expect(req.output_config.format).not.toHaveProperty('name');
    });

    it('sends no unexpected top-level params, no sampling, no thinking', async () => {
        const req = await call();
        for (const key of Object.keys(req)) expect(ALLOWED_TOP_LEVEL).toContain(key);
        for (const banned of ['temperature', 'top_p', 'top_k', 'thinking']) {
            expect(req[banned]).toBeUndefined();
        }
    });

    it('makes exactly ONE call per reply — the daily budget assumes it', async () => {
        const client = strictFake();
        await replyToMessage({ client, systemPrompt: 'p', userMessage: 'm' });
        expect(client.messages.create).toHaveBeenCalledTimes(1);
    });

    it('requires its inputs rather than sending an empty prompt', async () => {
        await expect(replyToMessage({ systemPrompt: 'p', userMessage: 'm' })).rejects.toThrow(/client/);
        await expect(replyToMessage({ client: strictFake(), userMessage: 'm' })).rejects.toThrow(/systemPrompt/);
        await expect(replyToMessage({ client: strictFake(), systemPrompt: 'p' })).rejects.toThrow(/userMessage/);
    });
});

describe('the reply schema stays inside the structured-outputs subset', () => {
    const walk = (node, visit) => {
        if (Array.isArray(node)) return node.forEach(n => walk(n, visit));
        if (node && typeof node === 'object') {
            visit(node);
            Object.values(node).forEach(v => walk(v, visit));
        }
    };

    it('uses no unsupported constraint keywords', () => {
        const UNSUPPORTED = ['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'patternProperties'];
        walk(REPLY_JSON_SCHEMA, (obj) => {
            for (const kw of UNSUPPORTED) expect(obj).not.toHaveProperty(kw);
        });
    });

    it('sets additionalProperties:false on every object', () => {
        walk(REPLY_JSON_SCHEMA, (obj) => {
            if (obj.type === 'object') expect(obj.additionalProperties).toBe(false);
        });
    });

    it('bounds reply length in ZOD instead, since the schema cannot', () => {
        const tooLong = { reply: 'x'.repeat(5000) };
        expect(parseReply(tooLong).ok).toBe(false);
        expect(parseReply(tooLong).reply.reply).toBe(''); // degrades to silence
    });
});

describe('reply parsing', () => {
    it('accepts a reply with a fact and a reason', () => {
        const r = parseReply({ reply: 'no thanks', fact: 'He asked me out.', reason: 'declined' });
        expect(r.ok).toBe(true);
        expect(r.reply.fact).toMatch(/asked me out/);
    });

    it('accepts an EMPTY reply — saying nothing is valid', () => {
        expect(parseReply({ reply: '' }).ok).toBe(true);
    });

    it.each([null, undefined, 'a string', 42, {}])('degrades junk (%s) to silence', (junk) => {
        const r = parseReply(junk);
        expect(r.ok).toBe(false);
        expect(r.reply.reply).toBe('');
    });

    it('NEVER throws', () => {
        expect(() => parseReply(Symbol('x'))).not.toThrow();
    });
});
