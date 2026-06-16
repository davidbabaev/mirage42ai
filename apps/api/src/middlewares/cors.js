const cors = require('cors');

const corsPolicyMiddleware = (cors({
    origin:[
        "http://localhost:5173",
        "http://localhost:8181",
        "https://db-social-media-app.onrender.com",
        "https://mirage-frontend-tfxf.onrender.com",
        "https://mirage42.com",
        "https://www.mirage42.com",
    ],
    // Required so the browser sends/stores the httpOnly refresh-token cookie on
    // cross-origin requests to /auth/refresh and /auth/logout.
    credentials: true,
}))

module.exports = corsPolicyMiddleware;

