// Single source of truth for which web origins may call the API. Used by BOTH
// the HTTP CORS middleware and the socket.io CORS config so the two can never
// drift apart again.
//
// In production the canonical front-end origin (PROD_ORIGIN) is ALWAYS allowed —
// so the deployed SPA can reach the API even if ALLOWED_ORIGINS is unset or
// misconfigured — and ALLOWED_ORIGINS (comma-separated) extends it with any
// additional deployed origins (e.g. preview deploys, a custom domain). Outside
// production we instead add the local Vite dev origin so `npm run dev` works with
// zero env setup. Read fresh from process.env on each call so it stays
// test-friendly.

const DEV_ORIGIN = 'http://localhost:5173';
// Canonical production front-end (custom domain). Baked in so the live SPA is
// allowed regardless of the ALLOWED_ORIGINS env var; set ALLOWED_ORIGINS to add
// any other still-live origins — the www subdomain, the previous Vercel URL, and
// preview deploys.
const PROD_ORIGIN = 'https://mirage42ai.com';

function getAllowedOrigins() {
    const fromEnv = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    const isProd = process.env.NODE_ENV === 'production';
    const origins = isProd
        ? [PROD_ORIGIN, ...fromEnv]   // prod: canonical origin always allowed
        : [...fromEnv, DEV_ORIGIN];   // dev: always allow the local Vite origin

    // De-dupe so a redundant ALLOWED_ORIGINS entry (e.g. listing PROD_ORIGIN or
    // the dev origin again) doesn't produce a doubled entry.
    return [...new Set(origins)];
}

// Vercel (and similar) preview deploys get a UNIQUE hostname per deploy/branch,
// so they can never be listed statically in ALLOWED_ORIGINS. Instead the
// operator sets PREVIEW_ORIGIN_REGEX to a pattern SCOPED TO THEIR PROJECT, e.g.
//   ^https://mirage42[a-z0-9-]*\.vercel\.app$
// A scoped regex (not a blanket *.vercel.app) is deliberate: with credentials
// enabled, allowing every vercel.app origin would let any site on that platform
// make credentialed requests. Unset ⇒ no preview origins are allowed.
function getPreviewOriginRegex() {
    const raw = (process.env.PREVIEW_ORIGIN_REGEX || '').trim();
    if (!raw) return null;
    try {
        return new RegExp(raw);
    } catch {
        // A malformed pattern must not crash CORS or silently allow everything —
        // treat it as "no preview matching configured".
        return null;
    }
}

// The single origin decision shared by the HTTP cors middleware and socket.io.
// Requests with no Origin header (curl, server-to-server, same-origin) are
// allowed — CORS only governs cross-origin browser requests.
function isOriginAllowed(origin) {
    if (!origin) return true;
    if (getAllowedOrigins().includes(origin)) return true;
    const rx = getPreviewOriginRegex();
    return rx ? rx.test(origin) : false;
}

module.exports = { getAllowedOrigins, isOriginAllowed, DEV_ORIGIN, PROD_ORIGIN };
