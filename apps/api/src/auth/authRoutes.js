const express = require('express');
const router = express.Router();
const { signNewToken } = require('./providers/jwt');
const {
    REFRESH_COOKIE,
    rotateRefreshToken,
    revokeRefreshToken,
    setRefreshCookie,
    clearRefreshCookie,
} = require('./refreshTokens');
const { pickSafeUserFields } = require('../users/service/usersSvc');
const { refreshLimiter } = require('../middlewares/rateLimit');

// Exchange a valid refresh cookie for a fresh access token. Rotates the refresh
// token on every call (the old cookie becomes invalid). No access token required
// here — that's the whole point: the access token has expired. Looser limit than
// login/register so multi-tab silent refresh doesn't trip it.
router.post('/auth/refresh', refreshLimiter, async (req, res) => {
    try {
        const presented = req.cookies?.[REFRESH_COOKIE];
        const rotated = await rotateRefreshToken(presented);

        if (!rotated) {
            clearRefreshCookie(res);
            return res.status(401).send('Invalid refresh token');
        }

        setRefreshCookie(res, rotated.rawToken);
        const token = signNewToken(rotated.user);
        res.send({ token, safeUser: pickSafeUserFields(rotated.user) });
    } catch (err) {
        clearRefreshCookie(res);
        res.status(401).send('Invalid refresh token');
    }
});

// Revoke this device's refresh token and clear the cookie. Idempotent.
router.post('/auth/logout', async (req, res) => {
    try {
        await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    } catch (err) {
        // best-effort; clearing the cookie below is what matters to the client
    }
    clearRefreshCookie(res);
    res.status(204).send();
});

module.exports = router;
