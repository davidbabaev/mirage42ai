// Cross-SITE refresh: in production the SPA (Vercel) and API (Render) are on
// different sites, so the refresh cookie MUST be minted with SameSite=None;
// Secure; HttpOnly — otherwise the browser won't store/send it and silent
// refresh breaks in prod. This exercises the real production cookie attributes
// AND the read-back round-trip (replay the cookie -> fresh access token), rather
// than just inspecting the config object.
//
// NOTE: NODE_ENV=production is set before the app is imported so cookieOptions()
// emits the cross-site attributes. It is restored afterwards so other test files
// aren't affected.

process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';
// validateEnv() hard-requires these in production; supply prod-like placeholders
// so the app boots in NODE_ENV=production and we can exercise the real cookie.
process.env.CLOUDINARY_CLOUD_NAME ||= 'test-cloud';
process.env.CLOUDINARY_API_KEY ||= 'test-key';
process.env.CLOUDINARY_API_SECRET ||= 'test-secret';
process.env.ALLOWED_ORIGINS ||= 'https://mirage42ai-web.vercel.app';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let app;
let originalNodeEnv;

const user = {
    name: 'Crosssite', lastName: 'Tester',
    email: 'crosssite-refresh@example.com',
    password: 'Password1!', phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
};

const refreshCookieFrom = (res) =>
    (res.headers['set-cookie'] || []).find((c) => c.startsWith('refresh-token='));

beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production'; // <- forces SameSite=None; Secure before app import

    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    const reg = await request(app).post('/users').send(user);
    if (reg.status !== 200) throw new Error(`register failed: ${reg.status} ${reg.text}`);
});

afterAll(async () => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const login = () =>
    request(app).post('/users/login').send({ email: user.email, password: user.password });

describe('cross-site refresh cookie (production mode)', () => {
    it('login mints the refresh cookie with HttpOnly + Secure + SameSite=None', async () => {
        const res = await login();
        expect(res.status).toBe(200);
        const cookie = refreshCookieFrom(res);
        expect(cookie).toBeTruthy();
        const c = cookie.toLowerCase();
        expect(c).toContain('httponly');
        expect(c).toContain('secure');
        expect(c).toContain('samesite=none');
    });

    it('register also mints a cross-site refresh cookie', async () => {
        const reg = await request(app).post('/users').send({ ...user, email: 'crosssite-refresh-2@example.com' });
        expect(reg.status).toBe(200);
        const c = (refreshCookieFrom(reg) || '').toLowerCase();
        expect(c).toContain('secure');
        expect(c).toContain('samesite=none');
    });

    it('the cross-site cookie is read back by /auth/refresh and yields a fresh access token', async () => {
        const cookie = refreshCookieFrom(await login());
        const res = await request(app).post('/auth/refresh').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
        // rotation re-issues a cross-site cookie too
        const rotated = (refreshCookieFrom(res) || '').toLowerCase();
        expect(rotated).toContain('secure');
        expect(rotated).toContain('samesite=none');
    });

    it('logout clears the cookie with the same cross-site attributes (so the browser drops it)', async () => {
        const cookie = refreshCookieFrom(await login());
        const res = await request(app).post('/auth/logout').set('Cookie', cookie);
        expect(res.status).toBe(204); // idempotent logout: No Content
        const cleared = (refreshCookieFrom(res) || '').toLowerCase();
        expect(cleared).toContain('secure');
        expect(cleared).toContain('samesite=none');
    });
});
