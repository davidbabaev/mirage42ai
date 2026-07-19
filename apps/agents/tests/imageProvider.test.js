// Phase F / F5 — the Gemini image provider and its prompts (§7, §6).
//
// The live API is NEVER called here. `fetchImpl` is injected and asserted
// against, so these tests pin the exact request shape documented at
// https://ai.google.dev/api/generate-content — the thing most likely to rot
// silently when a provider moves on.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { generateImage, ImageGenerationError, API_ROOT } = requireFromHere('../src/images/gemini.js');
const { buildReferencePrompt, buildScenePrompt, IMAGE_SAFETY_RULES } = requireFromHere('../src/images/imagePrompt.js');
const { readImageConfig, DEFAULT_IMAGE_MODEL } = requireFromHere('../src/config.js');

const PNG = 'iVBORw0KGgoAAAANSUhEUg==';

/** A fake fetch returning a well-formed generateContent image response. */
const okFetch = (data = PNG, mime = 'image/png') => vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
        candidates: [{ content: { parts: [{ inline_data: { mime_type: mime, data } }] }, finishReason: 'STOP' }],
    }),
}));

const call = (over = {}) => generateImage({
    apiKey: 'test-key',
    model: 'gemini-3.1-flash-image',
    prompt: 'a photo',
    fetchImpl: okFetch(),
    ...over,
});

describe('image config — a missing key disables images, it does not kill the agent', () => {
    it('reports no key when neither env var is set', () => {
        const cfg = readImageConfig({});
        expect(cfg.hasKey).toBe(false);
        expect(cfg.apiKey).toBe('');
    });

    it('reads GEMINI_API_KEY', () => {
        expect(readImageConfig({ GEMINI_API_KEY: 'abc' })).toMatchObject({ apiKey: 'abc', hasKey: true });
    });

    it('accepts GOOGLE_API_KEY as an alias — the key under the other name still works', () => {
        expect(readImageConfig({ GOOGLE_API_KEY: 'xyz' })).toMatchObject({ apiKey: 'xyz', hasKey: true });
    });

    it('treats whitespace as absent rather than sending a blank key', () => {
        expect(readImageConfig({ GEMINI_API_KEY: '   ' }).hasKey).toBe(false);
    });

    it('defaults to the model F5 targets, and allows an override', () => {
        expect(readImageConfig({}).model).toBe(DEFAULT_IMAGE_MODEL);
        // The first live run used gemini-2.5-flash-image and 400d on every
        // call; the current generateContent examples all use 3.1.
        expect(readImageConfig({}).model).toBe('gemini-3.1-flash-image');
        expect(readImageConfig({ AGENT_IMAGE_MODEL: 'gemini-2.5-flash-image' }).model)
            .toBe('gemini-2.5-flash-image');
    });
});

describe('generateImage — request shape (pinned to Google\'s documented API)', () => {
    it('POSTs to the documented generateContent URL for the model', async () => {
        const fetchImpl = okFetch();
        await call({ fetchImpl, model: 'gemini-3.1-flash-image' });

        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe(`${API_ROOT}/gemini-3.1-flash-image:generateContent`);
        expect(init.method).toBe('POST');
    });

    it('sends the key as the x-goog-api-key header, never in the URL', async () => {
        const fetchImpl = okFetch();
        await call({ fetchImpl, apiKey: 'secret-key' });

        const [url, init] = fetchImpl.mock.calls[0];
        expect(init.headers['x-goog-api-key']).toBe('secret-key');
        // A key in the query string leaks into logs and redirects.
        expect(url).not.toContain('secret-key');
        expect(url).not.toContain('key=');
    });

    it('sends the prompt as a text part', async () => {
        const fetchImpl = okFetch();
        await call({ fetchImpl, prompt: 'maya at a cafe' });

        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.contents[0].parts[0]).toEqual({ text: 'maya at a cafe' });
    });

    it('sends the reference face as an inline_data part alongside the prompt', async () => {
        const fetchImpl = okFetch();
        await call({
            fetchImpl,
            prompt: 'same person, at a cafe',
            referenceImage: { base64: 'REFBYTES', mimeType: 'image/jpeg' },
        });

        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.contents[0].parts).toHaveLength(2);
        expect(body.contents[0].parts[1]).toEqual({
            inline_data: { mime_type: 'image/jpeg', data: 'REFBYTES' },
        });
    });

    it('omits the image part entirely when there is no reference', async () => {
        const fetchImpl = okFetch();
        await call({ fetchImpl, referenceImage: null });

        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.contents[0].parts).toHaveLength(1);
    });
});

describe('generateImage — responses', () => {
    it('returns the decoded image and the model that made it', async () => {
        const result = await call({ fetchImpl: okFetch('BASE64DATA', 'image/jpeg') });
        expect(result).toEqual({ base64: 'BASE64DATA', mimeType: 'image/jpeg', model: 'gemini-3.1-flash-image' });
    });

    it('accepts camelCase inlineData as well as snake_case inline_data', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true, status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'CAMEL' } }] } }] }),
        }));
        await expect(call({ fetchImpl })).resolves.toMatchObject({ base64: 'CAMEL', mimeType: 'image/png' });
    });

    it('skips a leading text part and finds the image', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true, status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text: 'here you go' }, { inline_data: { mime_type: 'image/png', data: PNG } }] } }] }),
        }));
        await expect(call({ fetchImpl })).resolves.toMatchObject({ base64: PNG });
    });

    it('refuses without a key rather than calling the API', async () => {
        const fetchImpl = okFetch();
        await expect(call({ fetchImpl, apiKey: '' })).rejects.toThrow(/no image API key/);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('surfaces a safety refusal with its reason', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true, status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text: 'no' }] }, finishReason: 'IMAGE_SAFETY' }] }),
        }));
        await expect(call({ fetchImpl })).rejects.toThrow(/IMAGE_SAFETY/);
    });

    it('marks 429 and 5xx retryable, and 4xx not', async () => {
        const status = (s) => vi.fn(async () => ({ ok: false, status: s, text: async () => '{}' }));

        await expect(call({ fetchImpl: status(429) })).rejects.toMatchObject({ retryable: true, status: 429 });
        await expect(call({ fetchImpl: status(503) })).rejects.toMatchObject({ retryable: true, status: 503 });
        await expect(call({ fetchImpl: status(400) })).rejects.toMatchObject({ retryable: false, status: 400 });
    });

    it('wraps a network failure as a retryable ImageGenerationError', async () => {
        const fetchImpl = vi.fn(async () => { throw new Error('ECONNRESET'); });
        const err = await call({ fetchImpl }).catch((e) => e);
        expect(err).toBeInstanceOf(ImageGenerationError);
        expect(err.retryable).toBe(true);
    });
});

// REGRESSION — the first live reference-face run 400d on all four angles and
// the only thing the operator saw was "image API returned 400". Google had put
// the reason in the response body; the error path threw it away. These tests
// exist so the next failure explains itself.
describe('error bodies — Google\'s own words must reach the operator', () => {
    /** A realistic Google API error envelope. */
    const errorFetch = (status, body) => vi.fn(async () => ({
        ok: false, status, text: async () => body,
    }));

    const GOOGLE_400 = JSON.stringify({
        error: {
            code: 400,
            message: 'models/gemini-2.5-flash-image is not found for API version v1beta, or is not supported for generateContent.',
            status: 'INVALID_ARGUMENT',
        },
    });

    it('puts the real message in the thrown error, not just the status', async () => {
        const err = await call({ fetchImpl: errorFetch(400, GOOGLE_400) }).catch((e) => e);

        expect(err.message).toContain('400');
        expect(err.message).toContain('is not found for API version v1beta');
        expect(err.message).toContain('INVALID_ARGUMENT');
        // The old behaviour, which told the operator nothing.
        expect(err.message).not.toBe('image API returned 400');
    });

    it('keeps the body on the error object for the audit trail', async () => {
        const err = await call({ fetchImpl: errorFetch(400, GOOGLE_400) }).catch((e) => e);
        expect(err.body).toContain('not supported for generateContent');
    });

    it('falls back to raw text when the body is not JSON (proxy/gateway errors)', async () => {
        const err = await call({ fetchImpl: errorFetch(502, '<html><body>Bad Gateway</body></html>') }).catch((e) => e);
        expect(err.message).toMatch(/Bad Gateway/);
    });

    it('still throws a usable error when the body cannot be read at all', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: false, status: 500, text: async () => { throw new Error('stream closed'); },
        }));
        const err = await call({ fetchImpl }).catch((e) => e);

        expect(err).toBeInstanceOf(ImageGenerationError);
        expect(err.status).toBe(500);
        expect(err.message).toMatch(/could not be read/);
    });

    it('truncates a huge body rather than logging 40KB of HTML', async () => {
        const err = await call({ fetchImpl: errorFetch(400, 'x'.repeat(5000)) }).catch((e) => e);
        expect(err.body.length).toBeLessThanOrEqual(500);
    });
});

// REGRESSION — the other half of the 400: the URL. The body shape was right all
// along; the API version and the model were not.
describe('the request URL — API version and model', () => {
    it('defaults to /v1, which is what the current generateContent docs use', async () => {
        const fetchImpl = okFetch();
        await call({ fetchImpl });

        const [url] = fetchImpl.mock.calls[0];
        expect(url).toContain('/v1/models/');
        expect(url).not.toContain('/v1beta/');
    });

    it('allows an explicit apiVersion, so a bake-off does not need a code edit', async () => {
        const fetchImpl = okFetch();
        await call({ fetchImpl, apiVersion: 'v1beta', model: 'gemini-2.5-flash-image' });

        expect(fetchImpl.mock.calls[0][0]).toBe(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'
        );
    });

    it('builds the full documented URL for the default model', async () => {
        const fetchImpl = okFetch();
        await call({ fetchImpl, model: 'gemini-3.1-flash-image' });

        expect(fetchImpl.mock.calls[0][0]).toBe(
            'https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent'
        );
    });
});

describe('image prompts — §6 safety and the §7 amateur-phone look', () => {
    const APPEARANCE = 'early-30s woman, dark curly hair, freckles';

    it('puts the safety rules in the reference prompt', () => {
        const p = buildReferencePrompt({ appearance: APPEARANCE });
        for (const rule of IMAGE_SAFETY_RULES) expect(p).toContain(rule);
    });

    it('puts the safety rules in the scene prompt too', () => {
        const p = buildScenePrompt({ appearance: APPEARANCE, scene: 'at a cafe' });
        for (const rule of IMAGE_SAFETY_RULES) expect(p).toContain(rule);
    });

    it('forbids explicit content explicitly (§6)', () => {
        const p = buildScenePrompt({ appearance: APPEARANCE, scene: 'at a cafe' });
        expect(p).toMatch(/No nudity/i);
        expect(p).toMatch(/sexualised/i);
        expect(p).toMatch(/adult, clearly over 25/i);
    });

    it('asks for an amateur phone photo, not a glossy render (§7)', () => {
        const p = buildScenePrompt({ appearance: APPEARANCE, scene: 'at a cafe' });
        expect(p).toMatch(/phone/i);
        expect(p).toMatch(/Imperfect framing/i);
        expect(p).toMatch(/[Nn]ot retouched/);
        expect(p).toMatch(/no colour grading|no HDR/i);
    });

    it('leads with identity, then the scene — face as subject, not set dressing', () => {
        const p = buildScenePrompt({ appearance: APPEARANCE, scene: 'at a cafe in tel aviv' });
        expect(p.indexOf(APPEARANCE)).toBeLessThan(p.indexOf('at a cafe in tel aviv'));
        expect(p).toMatch(/SAME person shown in the reference image/);
        expect(p).toContain(APPEARANCE);
    });

    it('supports a faceless post — §7 says not every post needs the face', () => {
        const p = buildScenePrompt({ scene: 'the shakshuka she just ordered', includeFace: false });
        expect(p).toMatch(/no people in it at all/i);
        expect(p).toMatch(/No people, no faces/i);
        expect(p).not.toContain(APPEARANCE);
    });

    it('refuses to build a face prompt with no appearance text', () => {
        expect(() => buildScenePrompt({ scene: 'at a cafe' })).toThrow(/appearance/);
        expect(() => buildReferencePrompt({})).toThrow(/appearance/);
    });

    it('varies the reference set by angle so the set is 3–5 views of one face', () => {
        const a = buildReferencePrompt({ appearance: APPEARANCE, angle: 'three-quarter view, slight smile' });
        expect(a).toContain('three-quarter view, slight smile');
        expect(a).toContain(APPEARANCE);
    });
});
