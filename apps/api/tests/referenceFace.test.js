// Phase F / F5 — the one-time reference-face run (§7).
//
// §7: "per persona, generate one strong reference portrait set (one generation
// session, pick the best 3–5 angles/expressions of the same face). Store as the
// persona's visualIdentity."
//
// The generation call and the upload are both injected — this suite never
// contacts Gemini or Cloudinary and never spends anything.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const {
    generateReferenceSet, hasExistingFace, ANGLES, DEFAULT_APPEARANCE,
} = requireFromHere('../src/seed/generateReferenceFace');

const IMAGE_CONFIG = { apiKey: 'test-key', hasKey: true, model: 'gemini-3.1-flash-image' };
const QUIET = { log: () => {} };

const okGenerate = () => vi.fn(async () => ({
    base64: Buffer.from('IMAGE').toString('base64'),
    mimeType: 'image/png',
    model: 'gemini-3.1-flash-image',
}));

const okUpload = () => {
    let n = 0;
    return vi.fn(async () => `https://res.cloudinary.com/agents/reference/${++n}.jpg`);
};

const run = (over = {}) => generateReferenceSet({
    appearance: DEFAULT_APPEARANCE,
    imageConfig: IMAGE_CONFIG,
    generateImpl: okGenerate(),
    uploadImpl: okUpload(),
    logger: QUIET,
    ...over,
});

describe('the reference set — §7 asks for 3–5 angles of ONE face', () => {
    it('generates between 3 and 5 portraits', () => {
        expect(ANGLES.length).toBeGreaterThanOrEqual(3);
        expect(ANGLES.length).toBeLessThanOrEqual(5);
    });

    it('produces a visualIdentity carrying both halves of the conditioning', async () => {
        const identity = await run();

        expect(identity.appearance).toBe(DEFAULT_APPEARANCE);
        expect(identity.referenceUrls).toHaveLength(ANGLES.length);
        expect(identity.primaryUrl).toBe(identity.referenceUrls[0]);
        expect(identity.model).toBe('gemini-3.1-flash-image');
        expect(identity.generatedAt).toBeInstanceOf(Date);
    });

    it('sends the SAME appearance text with every angle — one face, several views', async () => {
        const generateImpl = okGenerate();
        await run({ generateImpl });

        const prompts = generateImpl.mock.calls.map((c) => c[0].prompt);
        expect(prompts).toHaveLength(ANGLES.length);
        for (const prompt of prompts) expect(prompt).toContain(DEFAULT_APPEARANCE);

        // Each prompt differs only by the angle.
        for (const [i, angle] of ANGLES.entries()) expect(prompts[i]).toContain(angle);
        expect(new Set(prompts).size).toBe(ANGLES.length);
    });

    it('carries the §6 safety rules into every reference prompt', async () => {
        const generateImpl = okGenerate();
        await run({ generateImpl });

        for (const call of generateImpl.mock.calls) {
            expect(call[0].prompt).toMatch(/No nudity/i);
            expect(call[0].prompt).toMatch(/adult, clearly over 25/i);
        }
    });

    it('sends no reference image — this run is what CREATES the reference', async () => {
        const generateImpl = okGenerate();
        await run({ generateImpl });
        for (const call of generateImpl.mock.calls) {
            expect(call[0].referenceImage).toBeUndefined();
        }
    });

    it('uploads to the agent reference folder, not the pending queue', async () => {
        const uploadImpl = okUpload();
        await run({ uploadImpl });
        for (const call of uploadImpl.mock.calls) expect(call[1]).toBe('reference');
    });

    it('describes a specific, recognisable face rather than a generic one', () => {
        // A vague appearance is the root cause of drift: the model fills the
        // gaps differently every time.
        expect(DEFAULT_APPEARANCE.length).toBeGreaterThan(200);
        expect(DEFAULT_APPEARANCE).toMatch(/freckles|mole|cheekbones/i);
    });
});

describe('partial failure — do not throw away angles already paid for', () => {
    it('keeps the successful angles when one generation fails', async () => {
        let call = 0;
        const generateImpl = vi.fn(async () => {
            if (++call === 2) throw new Error('IMAGE_SAFETY');
            return { base64: Buffer.from('IMAGE').toString('base64'), mimeType: 'image/png' };
        });

        const identity = await run({ generateImpl });
        expect(identity.referenceUrls).toHaveLength(ANGLES.length - 1);
    });

    it('throws only when every angle fails — nothing worth storing', async () => {
        const generateImpl = vi.fn(async () => { throw new Error('503'); });
        await expect(run({ generateImpl })).rejects.toThrow(/every angle failed/);
    });

    // REGRESSION — the first live run failed exactly this way and said only
    // "every angle failed — nothing to store", sending the operator back to
    // scroll the logs for a reason that had already been thrown away.
    it('reports the SHARED reason when every angle died the same way', async () => {
        const real = 'image API returned 400: models/x is not found for API version v1beta [INVALID_ARGUMENT]';
        const generateImpl = vi.fn(async () => { throw new Error(real); });

        const err = await run({ generateImpl }).catch((e) => e);
        expect(err.message).toContain('every angle failed with the same error');
        expect(err.message).toContain('is not found for API version v1beta');
        // and points at the tool that answers the question
        expect(err.message).toMatch(/diagnoseImageApi/);
    });

    it('lists the distinct reasons when angles failed differently', async () => {
        let n = 0;
        const generateImpl = vi.fn(async () => {
            throw new Error(++n % 2 ? 'image API returned 400: bad model' : 'image API returned 429: rate limited');
        });

        const err = await run({ generateImpl }).catch((e) => e);
        expect(err.message).toContain('bad model');
        expect(err.message).toContain('rate limited');
    });

    it('does not upload anything for a failed angle', async () => {
        const generateImpl = vi.fn(async () => { throw new Error('503'); });
        const uploadImpl = okUpload();
        await run({ generateImpl, uploadImpl }).catch(() => {});
        expect(uploadImpl).not.toHaveBeenCalled();
    });
});

describe('the overwrite guard — a second run makes a DIFFERENT person', () => {
    it('detects an existing face', () => {
        expect(hasExistingFace({ visualIdentity: { referenceUrls: ['https://x/1.jpg'] } })).toBe(true);
    });

    it('treats a persona with no face, an empty set, or no persona as generatable', () => {
        expect(hasExistingFace({})).toBe(false);
        expect(hasExistingFace({ visualIdentity: {} })).toBe(false);
        expect(hasExistingFace({ visualIdentity: { referenceUrls: [] } })).toBe(false);
        expect(hasExistingFace(null)).toBe(false);
    });

    it('does not count appearance text alone as a face — the portraits are the face', () => {
        expect(hasExistingFace({ visualIdentity: { appearance: 'dark curly hair' } })).toBe(false);
    });
});
