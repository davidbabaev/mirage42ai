const rateLimit = require('express-rate-limit');

// Skip rate limiting under tests so the suites (which hammer login/register)
// aren't throttled. Active in dev and production.
const skipInTest = () => process.env.NODE_ENV === 'test';

// Loose, app-wide cap to blunt general API abuse. Generous enough that a normal
// browsing session (or manual testing) never trips it.
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: { message: 'Too many requests from this IP, please try again later.' },
});

// Strict cap on credential endpoints (login/register) to stop brute-force.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: { message: 'Too many attempts from this IP, please try again in 15 minutes.' },
});

module.exports = { generalLimiter, authLimiter };
