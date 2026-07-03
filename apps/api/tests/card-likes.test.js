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
    email: `${slug}.likes@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let mongoServer, app;

// Shared users + card for all tests
let tokenOwner;
let tokenA, idA;
let tokenB, idB;
let tokenC;
let cardId;

const newCard = (token, title) =>
    request(app).post('/cards').set('auth-token', token)
        .field('title', title).field('content', 'body').field('category', 'general')
        .attach('media', Buffer.from('img'), { filename: 't.png', contentType: 'image/png' });

const likeCard = (token, id) =>
    request(app).patch(`/cards/${id}`).set('auth-token', token);

const followUser = (token, targetId) =>
    request(app).patch(`/users/${targetId}/follow`).set('auth-token', token);

const blockUser = (token, targetId) =>
    request(app).patch(`/users/${targetId}/block`).set('auth-token', token);

const getLikes = (token, id, qs = '') =>
    request(app).get(`/cards/${id}/likes${qs}`).set('auth-token', token);

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Stub cloudinary before loading app
    const cloudinaryPath = requireFromHere.resolve(path.join(__dirname, '../src/utils/cloudinary'));
    requireFromHere.cache[cloudinaryPath] = {
        id: cloudinaryPath, filename: cloudinaryPath, loaded: true,
        exports: fakeCloudinary, children: [], paths: [],
    };

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    // Register users
    const rOwner = await request(app).post('/users').send(mkUser('lk-owner', { name: 'Owner' }));
    tokenOwner = rOwner.body.token;

    const rA = await request(app).post('/users').send(mkUser('lk-a', { name: 'Alice' }));
    tokenA = rA.body.token; idA = rA.body.safeUser._id;

    const rB = await request(app).post('/users').send(mkUser('lk-b', { name: 'Bob' }));
    tokenB = rB.body.token; idB = rB.body.safeUser._id;

    const rC = await request(app).post('/users').send(mkUser('lk-c', { name: 'Carol' }));
    tokenC = rC.body.token;

    // Owner creates a card
    const cardRes = await newCard(tokenOwner, 'a liked post');
    cardId = cardRes.body._id;

    // A and B like the card
    await likeCard(tokenA, cardId);
    await likeCard(tokenB, cardId);

    // C follows A (so C.isFollowing=true for A, false for B)
    await followUser(tokenC, idA);
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('GET /cards/:id/likes', () => {
    it('requires authentication', async () => {
        const res = await request(app).get(`/cards/${cardId}/likes`);
        expect(res.status).toBe(401);
    });

    it('returns liker rows with correct shape and isFollowing', async () => {
        const res = await getLikes(tokenC, cardId);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('users');
        expect(res.body).toHaveProperty('nextCursor');

        const users = res.body.users;
        expect(users.length).toBe(2);

        const rowA = users.find(u => String(u._id) === idA);
        const rowB = users.find(u => String(u._id) === idB);
        expect(rowA).toBeTruthy();
        expect(rowB).toBeTruthy();

        // Shape check
        for (const row of [rowA, rowB]) {
            expect(row).toHaveProperty('_id');
            expect(row).toHaveProperty('name');
            expect(row).toHaveProperty('lastName');
            expect(row).toHaveProperty('job');
            expect(row).toHaveProperty('profilePicture');
            expect(row).toHaveProperty('followersCount');
            expect(row).toHaveProperty('isFollowing');
        }

        // C follows A → isFollowing true; C does not follow B → false
        expect(rowA.isFollowing).toBe(true);
        expect(rowB.isFollowing).toBe(false);
    });

    it('followersCount reflects actual followers', async () => {
        // D and E follow A
        const rD = await request(app).post('/users').send(mkUser('lk-d'));
        const rE = await request(app).post('/users').send(mkUser('lk-e'));
        await followUser(rD.body.token, idA);
        await followUser(rE.body.token, idA);

        const res = await getLikes(tokenC, cardId);
        const rowA = res.body.users.find(u => String(u._id) === idA);
        // C + D + E all follow A → 3 followers
        expect(rowA.followersCount).toBeGreaterThanOrEqual(3);
    });

    it('nextCursor is null when all results fit in one page', async () => {
        const res = await getLikes(tokenC, cardId);
        expect(res.body.nextCursor).toBeNull();
    });

    it('paginates: cursor returns next page and null nextCursor at end', async () => {
        // Create a fresh card and have 3 users like it; page with limit=2
        const rX = await request(app).post('/users').send(mkUser('lk-pg-x'));
        const rY = await request(app).post('/users').send(mkUser('lk-pg-y'));
        const rZ = await request(app).post('/users').send(mkUser('lk-pg-z'));
        const tokenX = rX.body.token;
        const tokenY = rY.body.token;
        const tokenZ = rZ.body.token;

        const cardRes = await newCard(tokenOwner, 'pagination card');
        const pgCardId = cardRes.body._id;

        await likeCard(tokenX, pgCardId);
        await likeCard(tokenY, pgCardId);
        await likeCard(tokenZ, pgCardId);

        // Page 1 — limit=2
        const page1 = await getLikes(tokenOwner, pgCardId, '?limit=2');
        expect(page1.status).toBe(200);
        expect(page1.body.users.length).toBe(2);
        expect(page1.body.nextCursor).not.toBeNull();

        // Page 2 — use the cursor from page 1
        const page2 = await getLikes(tokenOwner, pgCardId, `?limit=2&cursor=${page1.body.nextCursor}`);
        expect(page2.status).toBe(200);
        expect(page2.body.users.length).toBe(1);
        expect(page2.body.nextCursor).toBeNull();

        // No duplicates between pages
        const ids1 = page1.body.users.map(u => String(u._id));
        const ids2 = page2.body.users.map(u => String(u._id));
        expect(ids1.some(id => ids2.includes(id))).toBe(false);
    });

    it('omits a liker who is blocked by the requester', async () => {
        // Create blocker + victim users; victim likes a fresh card; blocker requests likes
        const rBlocker = await request(app).post('/users').send(mkUser('lk-blkr'));
        const rVictim = await request(app).post('/users').send(mkUser('lk-victim'));
        const tokenBlocker = rBlocker.body.token;
        const idVictim = rVictim.body.safeUser._id;
        const tokenVictim = rVictim.body.token;

        const cardRes = await newCard(tokenOwner, 'block-filter card');
        const blkCardId = cardRes.body._id;
        await likeCard(tokenVictim, blkCardId);

        // Without block: victim appears in likes
        const before = await getLikes(tokenBlocker, blkCardId);
        expect(before.body.users.some(u => String(u._id) === idVictim)).toBe(true);

        // Blocker blocks victim
        await blockUser(tokenBlocker, idVictim);

        // After block: victim is excluded from likes list
        const after = await getLikes(tokenBlocker, blkCardId);
        expect(after.body.users.some(u => String(u._id) === idVictim)).toBe(false);

        // Unblock for cleanup
        await blockUser(tokenBlocker, idVictim);
    });

    it('omits a liker who blocked the requester (reverse direction)', async () => {
        const rRequester = await request(app).post('/users').send(mkUser('lk-req2'));
        const rHiddenLiker = await request(app).post('/users').send(mkUser('lk-hidden'));
        const tokenRequester = rRequester.body.token;
        const idHiddenLiker = rHiddenLiker.body.safeUser._id;
        const tokenHiddenLiker = rHiddenLiker.body.token;

        const cardRes = await newCard(tokenOwner, 'reverse-block card');
        const rbCardId = cardRes.body._id;
        await likeCard(tokenHiddenLiker, rbCardId);

        // Hidden liker blocks the requester first
        await blockUser(tokenHiddenLiker, rRequester.body.safeUser._id);

        // Requester should not see the hidden liker in likes
        const res = await getLikes(tokenRequester, rbCardId);
        expect(res.body.users.some(u => String(u._id) === idHiddenLiker)).toBe(false);
    });

    it('404s when the card author is blocked by the requester', async () => {
        const rAuthor = await request(app).post('/users').send(mkUser('lk-auth2'));
        const rViewer = await request(app).post('/users').send(mkUser('lk-view2'));
        const tokenAuthor = rAuthor.body.token;
        const tokenViewer = rViewer.body.token;
        const idAuthor = rAuthor.body.safeUser._id;

        const cardRes = await newCard(tokenAuthor, 'author blocked card');
        const authCardId = cardRes.body._id;

        // Viewer blocks the author
        await blockUser(tokenViewer, idAuthor);

        const res = await getLikes(tokenViewer, authCardId);
        expect(res.status).toBe(404);

        // Unblock for cleanup
        await blockUser(tokenViewer, idAuthor);
    });

    it('404s when the card author blocked the requester (reverse direction)', async () => {
        const rAuthor2 = await request(app).post('/users').send(mkUser('lk-auth3'));
        const rViewer2 = await request(app).post('/users').send(mkUser('lk-view3'));
        const tokenAuthor2 = rAuthor2.body.token;
        const tokenViewer2 = rViewer2.body.token;
        const idViewer2 = rViewer2.body.safeUser._id;

        const cardRes = await newCard(tokenAuthor2, 'author blocks viewer card');
        const authCardId2 = cardRes.body._id;

        // Author blocks the viewer
        await blockUser(tokenAuthor2, idViewer2);

        const res = await getLikes(tokenViewer2, authCardId2);
        expect(res.status).toBe(404);
    });

    it('404s when the card is banned for a non-admin', async () => {
        // Create an admin user via direct DB update
        const rAdmin = await request(app).post('/users').send(mkUser('lk-admin'));
        const idAdmin = rAdmin.body.safeUser._id;

        // Promote to admin via mongoose (use require to get the already-compiled model)
        const User = requireFromHere('../src/users/models/User');
        await User.findByIdAndUpdate(idAdmin, { isAdmin: true });
        // Re-login to get a fresh token with isAdmin
        const loginRes = await request(app).post('/users/login').send({
            email: 'lk-admin.likes@example.com',
            password: 'Password1!',
        });
        const tokenAdmin = loginRes.body.token;

        const cardRes = await newCard(tokenOwner, 'to be banned card');
        const bannedCardId = cardRes.body._id;

        // Ban the card (admin action)
        await request(app).patch(`/cards/${bannedCardId}/ban`).set('auth-token', tokenAdmin);

        // Non-admin gets 404
        const nonAdminRes = await getLikes(tokenA, bannedCardId);
        expect(nonAdminRes.status).toBe(404);

        // Admin can still see it
        const adminRes = await getLikes(tokenAdmin, bannedCardId);
        expect(adminRes.status).toBe(200);
    });

    it('404s when card does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await getLikes(tokenA, fakeId);
        expect(res.status).toBe(404);
    });
});
