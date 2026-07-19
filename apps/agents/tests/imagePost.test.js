// Phase F / F5 — the image-post path (§7, §6).
//
// The properties under test, in order of how badly they would hurt if wrong:
//   1. a generated image goes to the REVIEW QUEUE and never to the feed,
//   2. the provider is called with the reference face + the scene, so it is the
//      same person somewhere new rather than a new stranger,
//   3. the per-day image cap actually bites,
//   4. a missing key degrades to a text post instead of breaking the tick.
//
// The provider and the API client are both injected. Nothing here touches the
// network, Gemini, or Cloudinary.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

// Safety net. Every path here is supposed to take an injected fetch/provider;
// if one ever forgets, this turns a silent outbound call to Google into a loud
// test failure. An earlier draft of this file did exactly that.
const realFetch = globalThis.fetch;
beforeAll(() => {
    globalThis.fetch = vi.fn(() => {
        throw new Error('the test suite must never make a real network call');
    });
});
afterAll(() => { globalThis.fetch = realFetch; });

const requireFromHere = createRequire(import.meta.url);
const { generateAndQueueImage, SKIP } = requireFromHere('../src/images/imagePost.js');
const { executeDecision } = requireFromHere('../src/loop.js');
const { BudgetLedger } = requireFromHere('../src/budget.js');

const DAY = Date.parse('2026-07-19T09:00:00Z');

const VISUAL_IDENTITY = {
    appearance: 'early-30s woman, dark curly hair, freckles, warm olive skin',
    referenceUrls: ['https://res.cloudinary.com/agents/reference/1.jpg'],
    primaryUrl: 'https://res.cloudinary.com/agents/reference/1.jpg',
    model: 'gemini-2.5-flash-image',
};

const mkAgent = (personaOver = {}) => ({
    user: { _id: 'agent-1', name: 'maya', lastName: 'ben-ari' },
    persona: {
        name: 'Maya Ben-Ari',
        dailyBudget: { llmCalls: 40, images: 1, actions: 20 },
        visualIdentity: VISUAL_IDENTITY,
        ...personaOver,
    },
});

const IMAGE_CONFIG = { apiKey: 'test-key', hasKey: true, model: 'gemini-2.5-flash-image' };

const DECISION = {
    action: 'post',
    text: 'beach was unreal this morning',
    imageScene: 'the sea from the promenade, early morning',
    imageIncludesFace: false,
};

/** Fake reference-image download. */
const refFetch = () => vi.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => new TextEncoder().encode('REFERENCE_BYTES').buffer,
    headers: { get: () => 'image/jpeg' },
}));

const mkApi = (over = {}) => ({
    createPost: vi.fn(async () => ({ _id: 'card-1' })),
    submitPendingImage: vi.fn(async () => ({ id: 'pending-1', status: 'pending' })),
    ...over,
});

const mkHarness = ({ persona, decision = DECISION, imageConfig = IMAGE_CONFIG, generateImpl, api } = {}) => {
    const budget = new BudgetLedger({ clock: () => DAY });
    return {
        budget,
        api: api || mkApi(),
        args: {
            agent: mkAgent(persona),
            session: { request: vi.fn() },
            decision,
            budget,
            imageConfig,
            fetchImpl: refFetch(),
            generateImpl: generateImpl || vi.fn(async () => ({
                base64: 'GENERATED', mimeType: 'image/png', model: 'gemini-2.5-flash-image',
            })),
        },
    };
};

const run = (h) => generateAndQueueImage({ ...h.args, api: h.api });

describe('image posts land in the review queue, never on the feed', () => {
    it('submits the generated image for approval', async () => {
        const h = mkHarness();
        const result = await run(h);

        expect(result.queued).toBe(true);
        expect(result.pendingId).toBe('pending-1');
        expect(h.api.submitPendingImage).toHaveBeenCalledTimes(1);
    });

    it('NEVER calls createPost from the image path — no direct publish', async () => {
        const h = mkHarness();
        await run(h);
        expect(h.api.createPost).not.toHaveBeenCalled();
    });

    it('carries the caption and the prompt into the queue for review', async () => {
        const h = mkHarness();
        await run(h);

        const submitted = h.api.submitPendingImage.mock.calls[0][1];
        expect(submitted.caption).toBe('beach was unreal this morning');
        expect(submitted.prompt).toMatch(/the sea from the promenade/);
        expect(submitted.image.base64).toBe('GENERATED');
    });

    it('reports a queue failure as a skip rather than throwing the tick', async () => {
        const h = mkHarness({ api: mkApi({ submitPendingImage: vi.fn(async () => { throw new Error('503'); }) }) });
        await expect(run(h)).resolves.toMatchObject({ queued: false, skipped: SKIP.UPLOAD_FAILED });
    });
});

describe('consistent face — the reference identity conditions the generation', () => {
    const faceDecision = { ...DECISION, imageScene: 'at a cafe in tel aviv', imageIncludesFace: true };

    it('sends the reference image AND the appearance text with the scene', async () => {
        const h = mkHarness({ decision: faceDecision });
        await run(h);

        const call = h.args.generateImpl.mock.calls[0][0];
        expect(call.referenceImage.base64).toBe(Buffer.from('REFERENCE_BYTES').toString('base64'));
        expect(call.prompt).toContain(VISUAL_IDENTITY.appearance);
        expect(call.prompt).toContain('at a cafe in tel aviv');
        expect(call.prompt).toMatch(/SAME person shown in the reference image/);
    });

    it('downloads the persona primary reference portrait', async () => {
        const h = mkHarness({ decision: faceDecision });
        await run(h);
        expect(h.args.fetchImpl).toHaveBeenCalledWith(VISUAL_IDENTITY.primaryUrl);
    });

    it('refuses a face post when the persona has no reference face', async () => {
        // Generating a face without a reference would invent a NEW stranger —
        // the exact failure §7 exists to prevent.
        const h = mkHarness({ persona: { visualIdentity: undefined }, decision: faceDecision });
        const result = await run(h);

        expect(result).toMatchObject({ queued: false, skipped: SKIP.NO_IDENTITY });
        expect(h.args.generateImpl).not.toHaveBeenCalled();
    });

    it('still allows a FACELESS post without any reference identity (§7)', async () => {
        const h = mkHarness({ persona: { visualIdentity: undefined } });
        const result = await run(h);

        expect(result.queued).toBe(true);
        const call = h.args.generateImpl.mock.calls[0][0];
        expect(call.referenceImage).toBeNull();
        expect(call.prompt).toMatch(/no people in it at all/i);
    });

    it('does not download a reference for a faceless post — cheaper by default', async () => {
        const h = mkHarness();
        await run(h);
        expect(h.args.fetchImpl).not.toHaveBeenCalled();
    });

    it('skips cleanly when the reference download fails', async () => {
        const h = mkHarness({ decision: faceDecision });
        h.args.fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }));
        await expect(run(h)).resolves.toMatchObject({ queued: false, skipped: SKIP.REFERENCE_FETCH_FAILED });
    });
});

describe('cost control — the per-day image cap (§6, §7)', () => {
    it('allows the first image and blocks the second at a cap of 1', async () => {
        const h = mkHarness();

        await expect(run(h)).resolves.toMatchObject({ queued: true });
        const second = await run(h);

        expect(second).toMatchObject({ queued: false, skipped: SKIP.BUDGET });
        expect(h.args.generateImpl).toHaveBeenCalledTimes(1);
    });

    it('honours a per-persona cap above the default', async () => {
        const h = mkHarness({ persona: { dailyBudget: { images: 3 } } });

        await run(h); await run(h); await run(h);
        expect(h.args.generateImpl).toHaveBeenCalledTimes(3);

        await expect(run(h)).resolves.toMatchObject({ skipped: SKIP.BUDGET });
    });

    it('honours a cap of 0 as "never" — not as unlimited', async () => {
        const h = mkHarness({ persona: { dailyBudget: { images: 0 } } });
        const result = await run(h);

        expect(result).toMatchObject({ queued: false, skipped: SKIP.BUDGET });
        expect(h.args.generateImpl).not.toHaveBeenCalled();
    });

    it('counts a REFUSED generation against the cap — a refusal still costs', async () => {
        const h = mkHarness({
            persona: { dailyBudget: { images: 1 } },
            generateImpl: vi.fn(async () => { throw new Error('image API returned no image (IMAGE_SAFETY)'); }),
        });

        await expect(run(h)).resolves.toMatchObject({ skipped: SKIP.GENERATION_FAILED });
        // Second attempt must be blocked by budget, not retried all day.
        await expect(run(h)).resolves.toMatchObject({ skipped: SKIP.BUDGET });
    });

    it('does not spend image budget when the key is missing', async () => {
        const h = mkHarness({ imageConfig: { hasKey: false, apiKey: '', model: 'x' } });
        await run(h);
        expect(h.budget.check('agent-1', 'images', { images: 1 }).spent).toBe(0);
    });
});

describe('missing provider key — the agent keeps running, text-only', () => {
    it('skips with no-image-key and never calls the provider', async () => {
        const h = mkHarness({ imageConfig: { hasKey: false, apiKey: '', model: 'x' } });
        const result = await run(h);

        expect(result).toMatchObject({ queued: false, skipped: SKIP.NO_KEY });
        expect(h.args.generateImpl).not.toHaveBeenCalled();
        expect(h.api.submitPendingImage).not.toHaveBeenCalled();
    });
});

describe('executeDecision — how the loop routes an image post', () => {
    // generateImpl/fetchImpl are injected here for the same reason they exist:
    // without them this path would reach the real Gemini endpoint. The suite
    // must never make an outbound call.
    const mkImagePost = (over = {}) => ({
        agent: mkAgent(),
        budget: new BudgetLedger({ clock: () => DAY }),
        imageConfig: IMAGE_CONFIG,
        runtimeSession: { request: vi.fn() },
        generateImpl: vi.fn(async () => ({
            base64: 'GENERATED', mimeType: 'image/png', model: 'gemini-2.5-flash-image',
        })),
        fetchImpl: vi.fn(async () => { throw new Error('no network in tests'); }),
        ...over,
    });

    it('queues the image and does NOT publish a text post', async () => {
        const api = mkApi();
        const outcome = await executeDecision({
            session: {}, decision: DECISION, api, imagePost: mkImagePost(),
        });

        expect(outcome).toMatchObject({ action: 'post_image_queued', ok: true, target: 'pending-1' });
        expect(api.createPost).not.toHaveBeenCalled();
    });

    it('falls back to a text post when images are unavailable, and says why', async () => {
        const api = mkApi();
        const outcome = await executeDecision({
            session: {}, decision: DECISION, api,
            imagePost: mkImagePost({ imageConfig: { hasKey: false, apiKey: '', model: 'x' } }),
        });

        expect(outcome.action).toBe('post');
        expect(outcome.ok).toBe(true);
        expect(outcome.detail).toMatch(/text-only \(no-image-key\)/);
        expect(api.createPost).toHaveBeenCalledWith({}, 'beach was unreal this morning');
    });

    it('publishes an ordinary text post when the decision asked for no image', async () => {
        const api = mkApi();
        const outcome = await executeDecision({
            session: {}, decision: { action: 'post', text: 'just text' }, api, imagePost: mkImagePost(),
        });

        expect(outcome.action).toBe('post');
        expect(api.createPost).toHaveBeenCalledWith({}, 'just text');
        expect(api.submitPendingImage).not.toHaveBeenCalled();
    });

    it('stays text-only when the loop wired no image support at all', async () => {
        const api = mkApi();
        const outcome = await executeDecision({ session: {}, decision: DECISION, api, imagePost: null });

        expect(outcome.action).toBe('post');
        expect(api.createPost).toHaveBeenCalled();
        expect(api.submitPendingImage).not.toHaveBeenCalled();
    });
});
