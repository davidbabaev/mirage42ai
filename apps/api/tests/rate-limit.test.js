import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'module';

// rateLimit.js is CommonJS; require it the same interop-safe way the other
// suites load CJS source modules.
const requireFromHere = createRequire(import.meta.url);
const { makeLimiter, generalLimiter, authLimiter, refreshLimiter } =
    requireFromHere('../src/middlewares/rateLimit');

const TEST_MESSAGE = 'Too many requests, slow down.';

// The real limiters skip under NODE_ENV=test (so the suites that hammer
// /login aren't throttled). Here we build a limiter with `skip: () => false`
// and a tiny `max` to exercise the 429 path directly, on a throwaway app — no
// Mongo, no global state touched. This validates the factory's mechanics, which
// generalLimiter / authLimiter / refreshLimiter all share.
const buildApp = (max) => {
    const app = express();
    app.use(makeLimiter({ max, skip: () => false, message: TEST_MESSAGE }));
    app.post('/login', (req, res) => res.status(200).send({ ok: true }));
    return app;
};

describe('rate limiter factory (makeLimiter)', () => {
    it('returns 429 with a { message } body once the limit is exceeded', async () => {
        const max = 3;
        const app = buildApp(max);

        // First `max` requests are allowed.
        for (let i = 0; i < max; i++) {
            const res = await request(app).post('/login');
            expect(res.status).toBe(200);
        }

        // The next one is throttled.
        const blocked = await request(app).post('/login');
        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({ message: TEST_MESSAGE });
        // standardHeaders is on, so the limit is advertised.
        expect(blocked.headers['ratelimit-limit']).toBe(String(max));
    });

    it('exports the three app limiters as middleware', () => {
        // Cheap guard that the named limiters exist and are middleware
        // (arity 3: req, res, next) — catches an accidental missing export.
        for (const mw of [generalLimiter, authLimiter, refreshLimiter]) {
            expect(typeof mw).toBe('function');
            expect(mw.length).toBe(3);
        }
    });
});
