/**
 * The Google Gemini image provider (F5, §7).
 *
 * THE ONLY FILE THAT KNOWS THE WIRE SHAPE. Everything upstream deals in
 * { prompt, referenceImage } → { base64, mimeType }, so swapping providers or
 * API generations is a change here and nowhere else. That is not hypothetical
 * tidiness: §7 explicitly expects a bake-off across providers, and Google's own
 * docs currently say "The Interactions API is now generally available. We
 * recommend using this API for access to all the latest features and models"
 * while `gemini-2.5-flash-image` remains stable on `generateContent`. This file
 * targets the documented generateContent shape for the 2.5 model David asked
 * for; moving to the Interactions API or the 3.x models edits this file only.
 *
 * Verified against https://ai.google.dev/api/generate-content and
 * https://ai.google.dev/gemini-api/docs/image-generation (July 2026):
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
 *   header: x-goog-api-key: <key>
 *   body:   { contents: [ { parts: [ {text}, {inline_data:{mime_type,data}} ] } ] }
 *   out:    candidates[].content.parts[].inline_data.{mime_type,data}   (base64)
 *
 * `fetchImpl` is injected so the suite can assert the exact request without a
 * network call — the same reason `decideImpl` is injected on the DM path. The
 * live API is NEVER called from tests.
 *
 * Note for reviewers: every image Google returns carries an invisible SynthID
 * watermark. That is a feature here — these are synthetic photos posted by a
 * synthetic person, and they should remain detectable as such.
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Long enough for a slow image generation, short enough that a wedged request
// cannot hold a heartbeat tick open indefinitely.
const DEFAULT_TIMEOUT_MS = 60_000;

/** Thrown for provider failures we expect and handle (skip the image, keep the agent alive). */
class ImageGenerationError extends Error {
    constructor(message, { status, retryable = false } = {}) {
        super(message);
        this.name = 'ImageGenerationError';
        this.status = status;
        this.retryable = retryable;
    }
}

/** Pulls the first image part out of a generateContent response. */
const extractImage = (body) => {
    const parts = body?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;

    for (const part of parts) {
        // The REST API uses snake_case; some SDK paths hand back camelCase.
        // Accepting both costs one line and removes a whole class of "worked in
        // curl, returned null in the worker".
        const inline = part?.inline_data || part?.inlineData;
        const data = inline?.data;
        if (typeof data === 'string' && data.length > 0) {
            return { base64: data, mimeType: inline.mime_type || inline.mimeType || 'image/png' };
        }
    }
    return null;
};

/** Why the model refused, when it refused without producing an image. */
const refusalReason = (body) => {
    const candidate = body?.candidates?.[0];
    const finish = candidate?.finishReason || candidate?.finish_reason;
    if (finish && finish !== 'STOP') return String(finish);
    if (body?.promptFeedback?.blockReason) return String(body.promptFeedback.blockReason);
    return null;
};

/**
 * Generates one image.
 *
 * @param {string}  prompt          The full text prompt (see imagePrompt.js).
 * @param {object} [referenceImage] { base64, mimeType } — the persona's face.
 * @returns {Promise<{base64: string, mimeType: string, model: string}>}
 */
const generateImage = async ({
    apiKey,
    model,
    prompt,
    referenceImage = null,
    fetchImpl,
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
    if (!apiKey) throw new ImageGenerationError('no image API key configured');
    if (!prompt) throw new ImageGenerationError('no prompt supplied');

    const doFetch = fetchImpl || globalThis.fetch;
    if (typeof doFetch !== 'function') {
        throw new ImageGenerationError('no fetch implementation available');
    }

    // Identity first, then the reference bytes — the text sets the task and the
    // image is the evidence for it.
    const parts = [{ text: prompt }];
    if (referenceImage?.base64) {
        parts.push({
            inline_data: {
                mime_type: referenceImage.mimeType || 'image/jpeg',
                data: referenceImage.base64,
            },
        });
    }

    // AbortSignal.timeout would be tidier but is awkward to drive from a fake
    // fetch in tests; an explicit controller keeps the injected path honest.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await doFetch(`${API_ROOT}/${model}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Header rather than ?key= so the secret cannot end up in a URL,
                // a redirect, or a log line.
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({ contents: [{ parts }] }),
            signal: controller.signal,
        });
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw new ImageGenerationError(`image generation timed out after ${timeoutMs}ms`, { retryable: true });
        }
        throw new ImageGenerationError(`image request failed: ${err.message}`, { retryable: true });
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const status = response.status;
        // 429/5xx are worth another tick; 4xx means the request itself is wrong.
        throw new ImageGenerationError(`image API returned ${status}`, {
            status,
            retryable: status === 429 || status >= 500,
        });
    }

    const body = await response.json();
    const image = extractImage(body);

    if (!image) {
        const reason = refusalReason(body);
        throw new ImageGenerationError(
            reason ? `image API returned no image (${reason})` : 'image API returned no image'
        );
    }

    return { ...image, model };
};

module.exports = { generateImage, ImageGenerationError, extractImage, API_ROOT, DEFAULT_TIMEOUT_MS };
