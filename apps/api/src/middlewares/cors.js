const cors = require('cors');
const { isOriginAllowed } = require('../config/allowedOrigins');

const corsPolicyMiddleware = (cors({
    // Function form so per-deploy preview origins (PREVIEW_ORIGIN_REGEX) are
    // matched dynamically alongside the static allowlist. A disallowed origin
    // resolves to `false` (ACAO header omitted, browser blocks) — not an error.
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    // Required so the browser sends/stores the httpOnly refresh-token cookie on
    // cross-origin requests to /auth/refresh and /auth/logout.
    credentials: true,
}))

module.exports = corsPolicyMiddleware;

