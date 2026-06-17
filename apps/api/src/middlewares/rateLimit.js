const rateLimit = require('express-rate-limit');

// Skip rate limiting under tests so the suites (which hammer login/register)
// aren't throttled. Active in dev and production. A focused rate-limit test
// passes `skip: () => false` to the factory to exercise the 429 path directly.
const skipInTest = () => process.env.NODE_ENV === 'test';

const FIFTEEN_MIN = 15 * 60 * 1000;

// Shared factory: every limiter uses the same 15-min window + header
// conventions; callers vary `max` and the message. `message` is a string and
// gets wrapped into the JSON 429 body shape `{ message }`.
const makeLimiter = ({ max, message, windowMs = FIFTEEN_MIN, skip = skipInTest }) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        skip,
        message: { message },
    });

// Loose, app-wide cap to blunt general API abuse. Generous enough that a normal
// browsing session (or manual testing) never trips it.
const generalLimiter = makeLimiter({
    max: 500,
    message: 'Too many requests from this IP, please try again later.',
});

// Strict cap on credential endpoints (login/register) to stop brute-force.
const authLimiter = makeLimiter({
    max: 10,
    message: 'Too many attempts from this IP, please try again in 15 minutes.',
});

// Looser cap on the silent token refresh: a signed-in user with several open
// tabs legitimately refreshes many times, so this clears comfortably above
// normal use while still bounding abuse.
const refreshLimiter = makeLimiter({
    max: 60,
    message: 'Too many token refreshes from this IP, please try again later.',
});

module.exports = { makeLimiter, generalLimiter, authLimiter, refreshLimiter };
