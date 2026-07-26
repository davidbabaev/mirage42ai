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
 * Verified against https://ai.google.dev/gemini-api/docs/generate-content/image-generation
 * (July 2026) — the generateContent variant of the image docs, which is a
 * DIFFERENT page from the default one (that one documents the Interactions API):
 *
 *   POST https://generativelanguage.googleapis.com/v1/models/<model>:generateContent
 *   header: x-goog-api-key: <key>
 *   body:   { contents: [ { parts: [ {text}, {inline_data:{mime_type,data}} ] } ] }
 *   out:    candidates[].content.parts[].inline_data.{mime_type,data}   (base64)
 *
 * The first live run 400d on every call. The body shape above was right; the
 * URL was not — it used /v1beta and gemini-2.5-flash-image, while the current
 * examples use /v1 and gemini-3.1-flash-image. Both are now variables, and the
 * error path reads Google's response body instead of throwing a bare status.
 *
 * `fetchImpl` is injected so the suite can assert the exact request without a
 * network call — the same reason `decideImpl` is injected on the DM path. The
 * live API is NEVER called from tests.
 *
 * Note for reviewers: every image Google returns carries an invisible SynthID
 * watermark. That is a feature here — these are synthetic photos posted by a
 * synthetic person, and they should remain detectable as such.
 */

// The API version is a variable, not a constant baked into a string, because it
// is one of the two things that turned out to be wrong on the first live run
// (the other was the model). Google's current generateContent image example
// uses /v1; /v1beta is the older path and is still live for other endpoints.
const API_HOST = 'https://generativelanguage.googleapis.com';
const DEFAULT_API_VERSION = 'v1';

const modelsRoot = (apiVersion = DEFAULT_API_VERSION) => `${API_HOST}/${apiVersion}/models`;

// Kept as an export for the tests and for anything still importing it.
const API_ROOT = modelsRoot();

// Long enough for a slow image generation, short enough that a wedged request
// cannot hold a heartbeat tick open indefinitely.
const DEFAULT_TIMEOUT_MS = 60_000;

/** Thrown for provider failures we expect and handle (skip the image, keep the agent alive). */
class ImageGenerationError extends Error {
    constructor(message, { status, retryable = false, body = '' } = {}) {
        super(message);
        this.name = 'ImageGenerationError';
        this.status = status;
        this.retryable = retryable;
        // Google's own words, kept for the audit trail and the operator.
        this.body = body;
    }
}

/**
 * Pulls the human-readable reason out of a Google API error response.
 *
 * The documented shape is { error: { code, message, status, details } }, but a
 * gateway or a proxy can return HTML or plain text instead — so this falls back
 * to the raw text rather than losing the reason to a JSON.parse throw. Truncated
 * because an HTML error page is not worth 40KB of log.
 */
const extractApiErrorMessage = (raw) => {
    if (!raw) return '';
    try {
        const parsed = JSON.parse(raw);
        const err = parsed?.error;
        if (err?.message) {
            const status = err.status ? ` [${err.status}]` : '';
            return `${err.message}${status}`;
        }
    } catch {
        // Not JSON — fall through to the raw text.
    }
    return raw.slice(0, 500).replace(/\s+/g, ' ').trim();
};

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
    apiVersion = DEFAULT_API_VERSION,
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
        response = await doFetch(`${modelsRoot(apiVersion)}/${model}:generateContent`, {
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
        // ALWAYS read the body. The first version of this threw a bare
        // "image API returned 400", which is exactly as useful as no error at
        // all: Google puts the actual reason (wrong model, wrong API version,
        // unsupported modality, bad key) in the body, and discarding it turned
        // a one-line fix into a guessing game. Reading it must never itself
        // throw, hence the catch.
        let detail = '';
        try {
            const body = await response.text();
            detail = extractApiErrorMessage(body);
        } catch {
            detail = '(response body could not be read)';
        }

        // 429/5xx are worth another tick; 4xx means the request itself is wrong.
        throw new ImageGenerationError(
            `image API returned ${status}${detail ? `: ${detail}` : ''}`,
            { status, retryable: status === 429 || status >= 500, body: detail }
        );
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

module.exports = {
    generateImage, ImageGenerationError, extractImage, extractApiErrorMessage,
    API_ROOT, API_HOST, DEFAULT_API_VERSION, modelsRoot, DEFAULT_TIMEOUT_MS,
};
