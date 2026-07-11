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

const FAKE_MEDIA_URL = 'https://fake.test/card-media.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

let mongoServer;
let app;

const mkUser = (slug, over = {}) => ({
    name: 'Alice',
    lastName: 'Tester',
    email: `${slug}.pctest@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30,
    birthDate: '1995-06-15',
    address: {},
    ...over,
});

let tokenA, userAId, userBId;
let cardId1, cardId2;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

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

    // Register two users.
    const regA = await request(app).post('/users').send(mkUser('pc-a', { name: 'Alice', lastName: 'Alpha' }));
    tokenA = regA.body.token;
    userAId = regA.body.safeUser._id;

    const regB = await request(app).post('/users').send(mkUser('pc-b', { name: 'Bob', lastName: 'Beta' }));
    userBId = regB.body.safeUser._id;

    // User A creates two cards (both default to status:'active').
    const c1 = await request(app)
        .post('/cards')
        .set('auth-token', tokenA)
        .field('title', 'Post One')
        .field('content', 'Content of post one')
        .field('category', 'general')
        .attach('media', Buffer.from('fake-bytes'), { filename: 'test.png', contentType: 'image/png' });
    cardId1 = c1.body._id;

    const c2 = await request(app)
        .post('/cards')
        .set('auth-token', tokenA)
        .field('title', 'Post Two')
        .field('content', 'Content of post two')
        .field('category', 'general')
        .attach('media', Buffer.from('fake-bytes'), { filename: 'test.png', contentType: 'image/png' });
    cardId2 = c2.body._id;

    // User B creates no cards.
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('postsCount on GET /users/:id', () => {
    it('returns postsCount matching the user\'s active card count', async () => {
        const res = await request(app)
            .get(`/users/${userAId}`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(typeof res.body.postsCount).toBe('number');
        // A created 2 cards.
        expect(res.body.postsCount).toBe(2);
    });

    it('returns postsCount = 0 for a user with no cards', async () => {
        const res = await request(app)
            .get(`/users/${userBId}`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.postsCount).toBe(0);
    });
});

describe('postsCount on GET /users (list)', () => {
    it('every entry in the list carries postsCount', async () => {
        const res = await request(app)
            .get('/users')
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        const a = res.body.find(u => u._id === userAId);
        const b = res.body.find(u => u._id === userBId);

        expect(a).toBeTruthy();
        expect(b).toBeTruthy();
        expect(typeof a.postsCount).toBe('number');
        expect(typeof b.postsCount).toBe('number');
        // A has 2 active posts, B has 0.
        expect(a.postsCount).toBe(2);
        expect(b.postsCount).toBe(0);
    });

    it('postsCount is case-insensitive wrt registration (compare via stored id)', async () => {
        // userAId is the canonical _id string from the registration response;
        // verify that it matches what the list returns — id comparison is exact.
        const res = await request(app)
            .get('/users')
            .set('auth-token', tokenA);
        const a = res.body.find(u => u._id.toLowerCase() === userAId.toLowerCase());
        expect(a).toBeTruthy();
        expect(a.postsCount).toBe(2);
    });
});

describe('postsCount on GET /users/search (browse grid)', () => {
    it('search results carry postsCount so the browse grid needs no global cards array', async () => {
        const res = await request(app)
            .get('/users/search')
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        const a = res.body.items.find(u => u._id === userAId);
        const b = res.body.items.find(u => u._id === userBId);
        expect(a).toBeTruthy();
        expect(a.postsCount).toBe(2);
        expect(b.postsCount).toBe(0);
    });
});

describe('GET /cards/:id', () => {
    it('returns 200 with the card for an active card id', async () => {
        const res = await request(app)
            .get(`/cards/${cardId1}`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(cardId1);
        expect(res.body.title).toBe('Post One');
        expect(res.body.status).toBe('active');
    });

    it('works without authentication (optionalAuth route)', async () => {
        const res = await request(app).get(`/cards/${cardId2}`);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(cardId2);
    });

    it('returns 404 for a non-existent card id', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .get(`/cards/${fakeId}`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(404);
    });
});
