const { buildScenePrompt } = require('./imagePrompt');
const { generateImage } = require('./gemini');

/**
 * The image-post path (F5, §7): decision → generated photo → REVIEW QUEUE.
 *
 * The contract this module keeps, and the reason it is separate from loop.js:
 * it can never publish. Its single success path ends at the pending queue. A
 * caller that wants an image on the feed has to go through an admin.
 *
 * Every failure here is a SKIP, never a throw. §7 treats images as garnish on a
 * text-first agent — no key, no face, no budget, a provider outage, a safety
 * refusal: all of them mean "post the text instead", not "break the tick".
 * The reasons are returned rather than swallowed so the audit trail can say
 * which one happened.
 */

const SKIP = {
    NO_KEY: 'no-image-key',
    NO_IDENTITY: 'no-visual-identity',
    BUDGET: 'image-budget-exhausted',
    GENERATION_FAILED: 'image-generation-failed',
    UPLOAD_FAILED: 'image-queue-failed',
    REFERENCE_FETCH_FAILED: 'reference-fetch-failed',
};

/** Downloads the reference portrait so it can be sent as conditioning bytes. */
const fetchReference = async (url, fetchImpl) => {
    const doFetch = fetchImpl || globalThis.fetch;
    const res = await doFetch(url);
    if (!res.ok) throw new Error(`reference image fetch returned ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    return {
        base64: buffer.toString('base64'),
        mimeType: res.headers?.get?.('content-type') || 'image/jpeg',
    };
};

/**
 * Generates one image for a post and files it for review.
 *
 * @returns {Promise<{queued: boolean, skipped?: string, detail?: string, pendingId?: string}>}
 */
const generateAndQueueImage = async ({
    agent,                 // { user, persona }
    session,
    decision,              // the validated post decision
    budget,
    imageConfig,           // { apiKey, hasKey, model }
    api,                   // agent API client (submitPendingImage lives here)
    fetchImpl,
    generateImpl = generateImage,
} = {}) => {
    const { user, persona } = agent;
    const agentId = String(user._id);

    // 1. Do we have a provider at all? Missing key is the documented clean skip.
    if (!imageConfig?.hasKey) {
        return { queued: false, skipped: SKIP.NO_KEY };
    }

    const wantsFace = decision.imageIncludesFace === true;
    const identity = persona?.visualIdentity;
    const referenceUrl = identity?.primaryUrl || identity?.referenceUrls?.[0];

    // 2. A face post with no reference face would be a NEW stranger every time —
    // the exact failure §7 exists to prevent. Skip rather than generate drift.
    if (wantsFace && (!referenceUrl || !identity?.appearance)) {
        return { queued: false, skipped: SKIP.NO_IDENTITY };
    }

    // 3. Cost control (§6, §7): images are the expensive action. Checked BEFORE
    // the call, recorded after a real spend.
    const imageBudget = budget.check(agentId, 'images', persona.dailyBudget || {});
    if (!imageBudget.allowed) {
        return {
            queued: false,
            skipped: SKIP.BUDGET,
            detail: `${imageBudget.spent}/${imageBudget.cap} images used today`,
        };
    }

    // 4. Reference bytes, only when a face is actually wanted.
    let referenceImage = null;
    if (wantsFace) {
        try {
            referenceImage = await fetchReference(referenceUrl, fetchImpl);
        } catch (err) {
            return { queued: false, skipped: SKIP.REFERENCE_FETCH_FAILED, detail: err.message };
        }
    }

    const prompt = buildScenePrompt({
        appearance: identity?.appearance,
        scene: decision.imageScene,
        includeFace: wantsFace,
    });

    // 5. Generate. Budget is recorded on a real provider call, including a
    // safety refusal — a refused generation still cost money and still counts
    // against the cap, otherwise a refusing prompt could retry all day.
    let image;
    try {
        image = await generateImpl({
            apiKey: imageConfig.apiKey,
            model: imageConfig.model,
            prompt,
            referenceImage,
            fetchImpl,
        });
    } catch (err) {
        budget.record(agentId, 'images');
        return { queued: false, skipped: SKIP.GENERATION_FAILED, detail: err.message };
    }
    budget.record(agentId, 'images');

    // 6. Hand it to the API for review. NOT to the feed.
    try {
        const pending = await api.submitPendingImage(session, {
            agentUserId: agentId,
            image,
            caption: decision.text,
            prompt,
            includedFace: wantsFace,
        });
        return { queued: true, pendingId: pending?.id, includedFace: wantsFace };
    } catch (err) {
        return { queued: false, skipped: SKIP.UPLOAD_FAILED, detail: err.message };
    }
};

module.exports = { generateAndQueueImage, fetchReference, SKIP };
