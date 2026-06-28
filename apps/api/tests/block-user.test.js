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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.block@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let mongoServer, app;
let tokenA, tokenB, idA, idB;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const cloudinaryPath = requireFromHere.resolve(path.join(__dirname, '../src/utils/cloudinary'));
    requireFromHere.cache[cloudinaryPath] = {
        id: cloudinaryPath, filename: cloudinaryPath, loaded: true,
        exports: fakeCloudinary, children: [], paths: [],
    };

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    const regA = await request(app).post('/users').send(mkUser('blk-a'));
    tokenA = regA.body.token; idA = regA.body.safeUser._id;
    const regB = await request(app).post('/users').send(mkUser('blk-b'));
    tokenB = regB.body.token; idB = regB.body.safeUser._id;

    // A and B follow each other, so we can assert the block tears it down.
    await request(app).patch(`/users/${idB}/follow`).set('auth-token', tokenA);
    await request(app).patch(`/users/${idA}/follow`).set('auth-token', tokenB);
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const block = (token, target) => request(app).patch(`/users/${target}/block`).set('auth-token', token);

describe('block user', () => {
    it('requires auth and rejects self-block', async () => {
        expect((await request(app).patch(`/users/${idB}/block`)).status).toBe(401);
        const self = await block(tokenA, idA);
        expect(self.status).toBe(400);
    });

    it('A blocking B records the block and removes the mutual follow', async () => {
        const res = await block(tokenA, idB);
        expect(res.status).toBe(200);
        expect(res.body.blocked).toContain(idB);
        expect(res.body.following || []).not.toContain(idB); // A no longer follows B

        // B no longer follows A either (self GET shows own following)
        const bSelf = await request(app).get(`/users/${idB}`).set('auth-token', tokenB);
        expect(bSelf.body.following || []).not.toContain(idA);
    });

    it('hides each user from the other in GET /users (both directions)', async () => {
        const aList = await request(app).get('/users').set('auth-token', tokenA);
        expect(aList.body.some(u => u._id === idB)).toBe(false);
        const bList = await request(app).get('/users').set('auth-token', tokenB);
        expect(bList.body.some(u => u._id === idA)).toBe(false);
    });

    it("404s the blocked user's profile in both directions", async () => {
        expect((await request(app).get(`/users/${idB}`).set('auth-token', tokenA)).status).toBe(404);
        expect((await request(app).get(`/users/${idA}`).set('auth-token', tokenB)).status).toBe(404);
    });

    it('rejects following across a block (both directions)', async () => {
        expect((await request(app).patch(`/users/${idB}/follow`).set('auth-token', tokenA)).status).toBe(403);
        expect((await request(app).patch(`/users/${idA}/follow`).set('auth-token', tokenB)).status).toBe(403);
    });

    it('unblock restores visibility', async () => {
        const res = await block(tokenA, idB); // toggle off
        expect(res.status).toBe(200);
        expect(res.body.blocked || []).not.toContain(idB);
        expect((await request(app).get(`/users/${idB}`).set('auth-token', tokenA)).status).toBe(200);
    });

    it('does not leak the blocked list in another user\'s public profile', async () => {
        // re-block so A has a non-empty blocked list, then B views A
        await block(tokenA, idB);
        await block(tokenA, idB); // unblock again to keep other state clean
        // C (third party) views A's public profile -> no `blocked` field
        const regC = await request(app).post('/users').send(mkUser('blk-c'));
        const aPublic = await request(app).get(`/users/${idA}`).set('auth-token', regC.body.token);
        expect(aPublic.status).toBe(200);
        expect(aPublic.body.blocked).toBeUndefined();
    });
});

// New surfaces: blocked list endpoint + app-wide content hiding (posts + comments).
describe('block hides content app-wide', () => {
    let tokenX, tokenY, idX, idY, idZ, tokenZ, xCardId, zCardId;

    const newCard = (token, title) =>
        request(app).post('/cards').set('auth-token', token)
            .field('title', title).field('content', 'body').field('category', 'general')
            .attach('media', Buffer.from('img'), { filename: 't.png', contentType: 'image/png' });

    beforeAll(async () => {
        const rX = await request(app).post('/users').send(mkUser('blk-x', { name: 'Xavier' }));
        tokenX = rX.body.token; idX = rX.body.safeUser._id;
        const rY = await request(app).post('/users').send(mkUser('blk-y', { name: 'Yara' }));
        tokenY = rY.body.token; idY = rY.body.safeUser._id;
        const rZ = await request(app).post('/users').send(mkUser('blk-z', { name: 'Zane' }));
        tokenZ = rZ.body.token; idZ = rZ.body.safeUser._id;

        // X posts a card; Z (soon-to-be-blocked) comments on it; Z also posts a card.
        xCardId = (await newCard(tokenX, 'x post')).body._id;
        await request(app).patch(`/cards/${xCardId}/comments`).set('auth-token', tokenZ)
            .send({ commentText: 'zane comment' });
        zCardId = (await newCard(tokenZ, 'z post')).body._id;

        // Y blocks Z.
        await request(app).patch(`/users/${idZ}/block`).set('auth-token', tokenY);
    }, 60_000);

    it('GET /users/blocked lists the blocked user with name + avatar', async () => {
        const res = await request(app).get('/users/blocked').set('auth-token', tokenY);
        expect(res.status).toBe(200);
        const row = res.body.find(u => u._id === idZ);
        expect(row).toBeTruthy();
        expect(row.name).toBe('zane');
        expect(row.profilePicture).toBeTruthy();
    });

    it("GET /cards hides the blocked user's posts and strips their comments", async () => {
        const res = await request(app).get('/cards').set('auth-token', tokenY);
        expect(res.status).toBe(200);
        // Z's own post is gone
        expect(res.body.some(c => c._id === zCardId)).toBe(false);
        // X's post is present but Z's comment is stripped
        const xCard = res.body.find(c => c._id === xCardId);
        expect(xCard).toBeTruthy();
        expect((xCard.comments || []).some(c => String(c.userId) === idZ)).toBe(false);
    });

    it("404s a blocked user's single post; keeps a third party's post (comment stripped)", async () => {
        expect((await request(app).get(`/cards/${zCardId}`).set('auth-token', tokenY)).status).toBe(404);
        const xCard = await request(app).get(`/cards/${xCardId}`).set('auth-token', tokenY);
        expect(xCard.status).toBe(200);
        expect((xCard.body.comments || []).some(c => String(c.userId) === idZ)).toBe(false);
    });

    it('a neutral viewer still sees everything', async () => {
        const res = await request(app).get('/cards').set('auth-token', tokenX);
        expect(res.body.some(c => c._id === zCardId)).toBe(true);
        const xCard = res.body.find(c => c._id === xCardId);
        expect((xCard.comments || []).some(c => String(c.userId) === idZ)).toBe(true);
    });

    it('unblock restores posts and empties the blocked list', async () => {
        await request(app).patch(`/users/${idZ}/block`).set('auth-token', tokenY); // toggle off
        const list = await request(app).get('/users/blocked').set('auth-token', tokenY);
        expect(list.body.some(u => u._id === idZ)).toBe(false);
        expect((await request(app).get(`/cards/${zCardId}`).set('auth-token', tokenY)).status).toBe(200);
    });
});
