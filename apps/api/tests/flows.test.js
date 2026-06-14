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

const FAKE_MEDIA_URL = 'https://fake.test/uploaded-card-media.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);

// The backend's Cloudinary helper is a CJS module that does
// `module.exports = uploadToCloudinary` and is required from cardsRoutes/usersRoutes
// via `require('../../utils/cloudinary')`. The cleanest way to intercept those
// require()s — without depending on vitest's ESM/CJS interop heuristics — is to
// pre-seed Node's require.cache before the app is imported.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

let mongoServer;
let app;

const userA = {
    name: 'Alice',
    lastName: 'Aaron',
    email: 'alice.test@example.com',
    password: 'Password1!',
    phone: '0501234567',
    age: 30,
    birthDate: '1995-06-15',
    address: {},
};

const userB = {
    name: 'Bob',
    lastName: 'Brown',
    email: 'bob.test@example.com',
    password: 'Password1!',
    phone: '0507654321',
    age: 28,
    birthDate: '1996-01-01',
    address: {},
};

let tokenA;
let userAId;
let userBId;
let cardId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Pre-seed Node's require.cache so deeper CJS requires of the cloudinary
    // helper receive our fake function instead of the real one.
    const cloudinaryPath = requireFromHere.resolve(
        path.join(__dirname, '../src/utils/cloudinary')
    );
    requireFromHere.cache[cloudinaryPath] = {
        id: cloudinaryPath,
        filename: cloudinaryPath,
        loaded: true,
        exports: fakeCloudinary,
        children: [],
        paths: [],
    };

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('core user + card flows (happy paths)', () => {
    it('registers user A successfully', async () => {
        const res = await request(app).post('/users').send(userA);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('safeUser');
        expect(res.body.safeUser).toHaveProperty('_id');
        expect(res.body.safeUser.email).toBe(userA.email);
        userAId = res.body.safeUser._id;
    });

    it('logs user A in with valid credentials and returns a JWT token', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: userA.email, password: userA.password });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
        // JWTs are dot-separated three-part strings; rough shape check.
        expect(res.body.token.split('.').length).toBe(3);
        tokenA = res.body.token;
    });

    it('registers user B (target for the follow flow)', async () => {
        const res = await request(app).post('/users').send(userB);
        expect(res.status).toBe(200);
        userBId = res.body.safeUser._id;
        expect(userBId).toBeTruthy();
        expect(userBId).not.toBe(userAId);
    });

    it('creates a card as user A using the auth-token header', async () => {
        const res = await request(app)
            .post('/cards')
            .set('auth-token', tokenA)
            .field('title', 'Test card')
            .field('content', 'Hello from the integration tests')
            .field('category', 'general')
            .attach('media', Buffer.from('fake-image-bytes'), {
                filename: 'test.png',
                contentType: 'image/png',
            });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('_id');
        expect(res.body.content).toBe('Hello from the integration tests');
        expect(res.body.mediaUrl).toBe(FAKE_MEDIA_URL);
        expect(res.body.mediaType).toBe('image');
        expect(String(res.body.userId)).toBe(userAId);
        cardId = res.body._id;
    });

    it('returns the new card from GET /cards', async () => {
        const res = await request(app).get('/cards');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const found = res.body.find(c => c._id === cardId);
        expect(found).toBeTruthy();
        expect(found.content).toBe('Hello from the integration tests');
    });

    it('likes the card (PATCH /cards/:id) and reflects the like on the card', async () => {
        const res = await request(app)
            .patch(`/cards/${cardId}`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.likes)).toBe(true);
        expect(res.body.likes).toContain(userAId);
    });

    it('adds a comment (PATCH /cards/:id/comments) and the comment appears on the card', async () => {
        const res = await request(app)
            .patch(`/cards/${cardId}/comments`)
            .set('auth-token', tokenA)
            .send({ commentText: 'Looks great!' });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.comments)).toBe(true);
        const ours = res.body.comments.find(c => c.commentText === 'Looks great!');
        expect(ours).toBeTruthy();
        expect(String(ours.userId)).toBe(userAId);
    });

    it('follows user B (PATCH /users/:id/follow) and reflects it on user A', async () => {
        const res = await request(app)
            .patch(`/users/${userBId}/follow`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.following)).toBe(true);
        expect(res.body.following).toContain(userBId);
    });
});

describe('GET /users gating + field projection', () => {
    const PII = ['email', 'phone', 'birthDate', 'isAdmin', 'isBanned', 'lastLoginAt'];

    it('returns 401 to unauthenticated callers (no internet scraping)', async () => {
        expect((await request(app).get('/users')).status).toBe(401);
        expect((await request(app).get(`/users/${userBId}`)).status).toBe(401);
    });

    it('gives a non-admin only a PUBLIC projection of OTHER users (no PII)', async () => {
        const res = await request(app).get('/users').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        const other = res.body.find(u => u._id === userBId);
        expect(other).toBeTruthy();
        PII.forEach(f => expect(other).not.toHaveProperty(f));
        ['street', 'house', 'zip'].forEach(f => expect(other.address || {}).not.toHaveProperty(f));
        // safe fields the UI relies on are still present
        expect(other).toHaveProperty('name');
        expect(other).toHaveProperty('following');
    });

    it('still gives a user their OWN full record (email present)', async () => {
        const res = await request(app).get('/users').set('auth-token', tokenA);
        const me = res.body.find(u => u._id === userAId);
        expect(me.email).toBe(userA.email);
    });

    it('GET /users/:id hides PII for others but exposes it for self', async () => {
        const other = await request(app).get(`/users/${userBId}`).set('auth-token', tokenA);
        expect(other.status).toBe(200);
        PII.forEach(f => expect(other.body).not.toHaveProperty(f));

        const self = await request(app).get(`/users/${userAId}`).set('auth-token', tokenA);
        expect(self.body.email).toBe(userA.email);
    });
});
