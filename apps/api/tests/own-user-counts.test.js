// Safe placeholder env vars before any app code is loaded.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

// The logged-in user's own postsCount / followersCount must come from the SERVER
// on the auth entry points. Without them the own-profile sidebar and dashboard
// have no source for "N posts / N followers" except deriving them from a
// fully-loaded users/cards array — the thing this epic removes.

const FAKE_MEDIA_URL = 'https://fake.test/uploaded-card-media.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

let mongoServer;
let app;

const mkUser = (slug, over = {}) => ({
    name: 'Alice', lastName: 'Tester',
    email: `${slug}.owncounts@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

const PASSWORD = 'Password1!';
let tokenA, userAId, emailA;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const cloudinaryPath = requireFromHere.resolve(
        path.join(__dirname, '../src/utils/cloudinary')
    );
    requireFromHere.cache[cloudinaryPath] = {
        id: cloudinaryPath, filename: cloudinaryPath, loaded: true,
        exports: fakeCloudinary, children: [], paths: [],
    };

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    emailA = mkUser('oc-a').email;
    const regA = await request(app).post('/users').send(mkUser('oc-a'));
    tokenA = regA.body.token;
    userAId = regA.body.safeUser._id;

    // A posts twice.
    for (const title of ['Post one', 'Post two']) {
        await request(app)
            .post('/cards').set('auth-token', tokenA)
            .field('title', title).field('content', 'body').field('category', 'general')
            .attach('media', Buffer.from('x'), { filename: 'm.png', contentType: 'image/png' });
    }

    // Two other users follow A.
    for (const slug of ['oc-b', 'oc-c']) {
        const reg = await request(app).post('/users').send(mkUser(slug));
        await request(app)
            .patch(`/users/${userAId}/follow`).set('auth-token', reg.body.token);
    }
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('own-user counts on the auth entry points', () => {
    it('register returns postsCount and followersCount', async () => {
        const reg = await request(app).post('/users').send(mkUser('oc-fresh'));
        expect(reg.status).toBe(200);
        // A brand-new user has nothing yet — but the FIELDS must be present, or the
        // client has no way to tell "zero posts" from "counts not loaded".
        expect(reg.body.safeUser.postsCount).toBe(0);
        expect(reg.body.safeUser.followersCount).toBe(0);
        expect(reg.body.safeUser.followingCount).toBe(0);
    });

    it('login returns the real postsCount and followersCount', async () => {
        const res = await request(app)
            .post('/users/login').send({ email: emailA, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.safeUser.postsCount).toBe(2);
        expect(res.body.safeUser.followersCount).toBe(2);
    });

    it('counts agree with GET /users/:id (one source of truth)', async () => {
        const login = await request(app)
            .post('/users/login').send({ email: emailA, password: PASSWORD });
        const profile = await request(app)
            .get(`/users/${userAId}`).set('auth-token', tokenA);

        expect(login.body.safeUser.postsCount).toBe(profile.body.postsCount);
        expect(login.body.safeUser.followersCount).toBe(profile.body.followersCount);
    });

    it('a silent token refresh does not blank the counts', async () => {
        // The refresh response REPLACES the client's user object, so it has to
        // carry the counts too — otherwise they vanish mid-session.
        const login = await request(app)
            .post('/users/login').send({ email: emailA, password: PASSWORD });
        const cookie = login.headers['set-cookie'];
        expect(cookie).toBeTruthy();

        const refreshed = await request(app).post('/auth/refresh').set('Cookie', cookie);
        expect(refreshed.status).toBe(200);
        expect(refreshed.body.safeUser.postsCount).toBe(2);
        expect(refreshed.body.safeUser.followersCount).toBe(2);
    });
});
