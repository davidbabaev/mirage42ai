// Safe placeholder env vars before any app code is loaded.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';
// Short access-token TTL is the default '15m'; tests forge expired tokens directly.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let app;

const user = {
    name: 'Refresh',
    lastName: 'Tester',
    email: 'refresh-tester@example.com',
    password: 'Password1!',
    phone: '0501234567',
    age: 30,
    birthDate: '1995-06-15',
    address: {},
};

// Pull the refresh-token cookie out of a Set-Cookie header array.
const refreshCookieFrom = (res) => {
    const cookies = res.headers['set-cookie'] || [];
    return cookies.find((c) => c.startsWith('refresh-token='));
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    const reg = await request(app).post('/users').send(user);
    if (reg.status !== 200) {
        throw new Error(`Failed to register baseline test user: ${reg.status} ${reg.text}`);
    }
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const login = () =>
    request(app).post('/users/login').send({ email: user.email, password: user.password });

describe('refresh cookie issuance', () => {
    it('login sets an httpOnly refresh-token cookie alongside the access token', async () => {
        const res = await login();
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        const cookie = refreshCookieFrom(res);
        expect(cookie).toBeTruthy();
        expect(cookie.toLowerCase()).toContain('httponly');
    });
});

describe('POST /auth/refresh', () => {
    it('returns a fresh access token when given a valid refresh cookie', async () => {
        const loginRes = await login();
        const cookie = refreshCookieFrom(loginRes);

        const res = await request(app).post('/auth/refresh').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
    });

    it('returns 401 when no refresh cookie is presented', async () => {
        const res = await request(app).post('/auth/refresh');
        expect(res.status).toBe(401);
    });

    it('rotates the refresh token: the old cookie is rejected after a refresh', async () => {
        const loginRes = await login();
        const oldCookie = refreshCookieFrom(loginRes);

        const first = await request(app).post('/auth/refresh').set('Cookie', oldCookie);
        expect(first.status).toBe(200);

        // The original (now-rotated) refresh token must no longer be accepted.
        const reuse = await request(app).post('/auth/refresh').set('Cookie', oldCookie);
        expect(reuse.status).toBe(401);
    });
});

describe('access-token expiry', () => {
    it('rejects an expired access token with 401', async () => {
        const loginRes = await login();
        // Find the real user id so the middleware DB lookup succeeds.
        const me = jwt.decode(loginRes.body.token);
        const expired = jwt.sign({ userId: me.userId }, process.env.JWT_SECRET, { expiresIn: -10 });

        const res = await request(app).get('/users').set('auth-token', expired);
        expect(res.status).toBe(401);
    });
});
