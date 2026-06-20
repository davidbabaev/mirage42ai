// Single source of truth for which web origins may call the API. Used by BOTH
// the HTTP CORS middleware and the socket.io CORS config so the two can never
// drift apart again.
//
// In production the list comes entirely from ALLOWED_ORIGINS — a comma-separated
// list of deployed front-end origins (e.g. the Vercel URL). Outside production
// we always add the local Vite dev origin so `npm run dev` works with zero env
// setup. Read fresh from process.env on each call so it stays test-friendly.

const DEV_ORIGIN = 'http://localhost:5173';

function getAllowedOrigins() {
    const fromEnv = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    const isProd = process.env.NODE_ENV === 'production';
    const origins = isProd ? fromEnv : [...fromEnv, DEV_ORIGIN];

    // De-dupe so an ALLOWED_ORIGINS that already lists localhost:5173 in dev
    // doesn't produce a doubled entry.
    return [...new Set(origins)];
}

module.exports = { getAllowedOrigins, DEV_ORIGIN };
