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
// Canonical production front-end (Vercel). Baked in so the live SPA is allowed
// regardless of the ALLOWED_ORIGINS env var; set ALLOWED_ORIGINS to add more.
const PROD_ORIGIN = 'https://mirage42ai-web.vercel.app';

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

module.exports = { getAllowedOrigins, DEV_ORIGIN, PROD_ORIGIN };
