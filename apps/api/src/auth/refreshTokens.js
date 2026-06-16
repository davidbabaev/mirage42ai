const crypto = require('crypto');
const User = require('../users/models/User');

// Long-lived refresh token. Opaque random string handed to the client in an
// httpOnly cookie; only its SHA-256 hash is stored on the user. Each use is
// rotated (old hash removed, new one added) so a stolen token is single-use.
const REFRESH_COOKIE = 'refresh-token';
const REFRESH_TOKEN_TTL_MS =
    Number(process.env.REFRESH_TOKEN_TTL_MS) || 7 * 24 * 60 * 60 * 1000; // 7 days

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const isProd = () => process.env.NODE_ENV === 'production';

// In prod the SPA and API are on different sites, so the cookie must be
// SameSite=None;Secure to be sent cross-site. In local dev everything is on
// localhost (same site across ports), so Lax over http works and stays sendable.
const cookieOptions = () => ({
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    path: '/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
});

const setRefreshCookie = (res, rawToken) => {
    res.cookie(REFRESH_COOKIE, rawToken, cookieOptions());
};

const clearRefreshCookie = (res) => {
    const { maxAge, ...opts } = cookieOptions();
    res.clearCookie(REFRESH_COOKIE, opts);
};

// Drop expired records so the array doesn't grow unbounded.
const pruneExpired = (user) => {
    const now = Date.now();
    user.refreshTokens = user.refreshTokens.filter((t) => t.expiresAt.getTime() > now);
};

// Issue a brand-new refresh token for a user and persist its hash.
const issueRefreshToken = async (user) => {
    const raw = crypto.randomBytes(40).toString('hex');
    pruneExpired(user);
    user.refreshTokens.push({
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    await user.save();
    return raw;
};

// Validate a presented refresh token and rotate it. Returns { user, rawToken }
// on success, or null if the token is unknown/expired/already-rotated.
const rotateRefreshToken = async (rawToken) => {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);

    const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash });
    if (!user) return null;

    const record = user.refreshTokens.find((t) => t.tokenHash === tokenHash);
    if (!record || record.expiresAt.getTime() <= Date.now()) {
        // Expired (or raced): clean it up and refuse.
        user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
        await user.save();
        return null;
    }

    // Rotate: remove the used token, mint a new one.
    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    const rawNew = await issueRefreshToken(user);
    return { user, rawToken: rawNew };
};

// Revoke a single refresh token (logout of this device).
const revokeRefreshToken = async (rawToken) => {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await User.updateOne(
        { 'refreshTokens.tokenHash': tokenHash },
        { $pull: { refreshTokens: { tokenHash } } },
    );
};

module.exports = {
    REFRESH_COOKIE,
    setRefreshCookie,
    clearRefreshCookie,
    issueRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
};
