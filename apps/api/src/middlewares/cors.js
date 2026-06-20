const cors = require('cors');
const { getAllowedOrigins } = require('../config/allowedOrigins');

const corsPolicyMiddleware = (cors({
    origin: getAllowedOrigins(),
    // Required so the browser sends/stores the httpOnly refresh-token cookie on
    // cross-origin requests to /auth/refresh and /auth/logout.
    credentials: true,
}))

module.exports = corsPolicyMiddleware;

