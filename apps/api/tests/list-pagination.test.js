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

const FAKE_MEDIA_URL = 'https://fake.test/lp-card-media.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.lp@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

// Helper: post a card with a fake media file
const newCard = (app, token, title) =>
    request(app).post('/cards').set('auth-token', token)
        .field('title', title).field('content', 'body').field('category', 'general')
        .attach('media', Buffer.from('img'), { filename: 't.png', contentType: 'image/png' });

// Helper: collect all items from a cursor-paginated endpoint (keyset).
// Stops when nextCursor is null or when the guard limit is hit.
const collectAll = async (app, token, basePath, limit) => {
    const items = [];
    let cursor;
    for (let guard = 0; guard < 200; guard++) {
        const sep = basePath.includes('?') ? '&' : '?';
        const url = `${basePath}${sep}limit=${limit}` +
            (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
        const res = await request(app).get(url).set('auth-token', token);
        expect(res.status).toBe(200);
        items.push(...res.body.items);
        if (!res.body.nextCursor) break;
        cursor = res.body.nextCursor;
    }
    return items;
};

let mongoServer, app;
// A: primary requester
// B: author of cards
// C: third user for block tests
// D: a user that blocks A (block-either-way test)
let tokenA, idA, tokenB, idB, tokenC, idC, tokenD, idD;
let bCardIds = [];

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

    // Register users
    const rA = await request(app).post('/users').send(mkUser('lp-a'));
    tokenA = rA.body.token; idA = rA.body.safeUser._id;

    const rB = await request(app).post('/users').send(mkUser('lp-b'));
    tokenB = rB.body.token; idB = rB.body.safeUser._id;

    const rC = await request(app).post('/users').send(mkUser('lp-c'));
    tokenC = rC.body.token; idC = rC.body.safeUser._id;

    const rD = await request(app).post('/users').send(mkUser('lp-d'));
    tokenD = rD.body.token; idD = rD.body.safeUser._id;

    // A follows B (for followers/following tests)
    await request(app).patch(`/users/${idB}/follow`).set('auth-token', tokenA);
    // C follows B as well
    await request(app).patch(`/users/${idB}/follow`).set('auth-token', tokenC);

    // B posts 7 cards (enough for multi-page pagination at limit=2)
    for (let i = 0; i < 7; i++) {
        const r = await newCard(app, tokenB, `LP post ${i}`);
        bCardIds.push(String(r.body._id));
    }

    // Add 3 comments to B's first card (from A, B, C)
    await request(app).patch(`/cards/${bCardIds[0]}/comments`)
        .set('auth-token', tokenA).send({ commentText: 'comment from A' });
    await request(app).patch(`/cards/${bCardIds[0]}/comments`)
        .set('auth-token', tokenB).send({ commentText: 'comment from B' });
    await request(app).patch(`/cards/${bCardIds[0]}/comments`)
        .set('auth-token', tokenC).send({ commentText: 'comment from C' });
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

// ─── GET /cards/explore ─────────────────────────────────────────────────────

describe('GET /cards/explore', () => {
    it('requires authentication', async () => {
        const res = await request(app).get('/cards/explore');
        expect(res.status).toBe(401);
    });

    it('returns { items, nextCursor } shape', async () => {
        const res = await request(app).get('/cards/explore').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
    });

    it('honors limit and returns nextCursor when more remain', async () => {
        const res = await request(app)
            .get('/cards/explore?limit=2')
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        // B posted 7 cards; 2 < 7 so there must be a next cursor
        expect(res.body.items.length).toBe(2);
        expect(typeof res.body.nextCursor).toBe('string');
    });

    it('paging through with limit=2 yields no duplicates and ends with null cursor', async () => {
        const items = await collectAll(app, tokenA, '/cards/explore', 2);
        const ids = items.map(c => String(c._id));
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length); // no duplicates
        // All of B's 7 cards must appear
        for (const id of bCardIds) expect(unique.has(id)).toBe(true);
    });

    it('optional userId filters to one author\'s posts only', async () => {
        const res = await request(app)
            .get(`/cards/explore?userId=${idB}`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        for (const card of res.body.items) {
            expect(String(card.userId)).toBe(idB);
        }
    });

    it('block-aware: blocked author\'s posts never appear across any page', async () => {
        // D blocks B — use D so A's follow of B stays intact for later tests
        await request(app).patch(`/users/${idB}/block`).set('auth-token', tokenD);

        const items = await collectAll(app, tokenD, '/cards/explore', 2);
        const ids = items.map(c => String(c._id));
        for (const bId of bCardIds) expect(ids).not.toContain(bId);

        // Cleanup: unblock
        await request(app).patch(`/users/${idB}/block`).set('auth-token', tokenD);
    });

    it('block-aware: if blocked user is the target userId, returns empty', async () => {
        // D blocks B — use D so A's follow of B stays intact for later tests
        await request(app).patch(`/users/${idB}/block`).set('auth-token', tokenD);

        const res = await request(app)
            .get(`/cards/explore?userId=${idB}`)
            .set('auth-token', tokenD);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(0);
        expect(res.body.nextCursor).toBeNull();

        // Cleanup
        await request(app).patch(`/users/${idB}/block`).set('auth-token', tokenD);
    });

    it('malformed cursor → 400', async () => {
        const res = await request(app)
            .get('/cards/explore?cursor=not-a-cursor')
            .set('auth-token', tokenA);
        expect(res.status).toBe(400);
    });
});

// ─── GET /users/browse ──────────────────────────────────────────────────────

describe('GET /users/browse', () => {
    it('requires authentication', async () => {
        const res = await request(app).get('/users/browse');
        expect(res.status).toBe(401);
    });

    it('returns { items, nextCursor } shape', async () => {
        const res = await request(app).get('/users/browse').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
    });

    it('honors limit and returns nextCursor when more remain', async () => {
        // We have ≥4 users (A,B,C,D); limit=2 should yield nextCursor
        const res = await request(app)
            .get('/users/browse?limit=2')
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(2);
        expect(typeof res.body.nextCursor).toBe('string');
    });

    it('paging through with limit=1 yields no duplicates', async () => {
        const items = await collectAll(app, tokenA, '/users/browse', 1);
        const ids = items.map(u => String(u._id));
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
        // B, C, D should all appear (A might or might not depending on self-inclusion)
        expect(unique.has(idB)).toBe(true);
        expect(unique.has(idC)).toBe(true);
    });

    it('block-aware: blocked user never appears across any page (either direction)', async () => {
        // D blocks A
        await request(app).patch(`/users/${idA}/block`).set('auth-token', tokenD);

        // A's browse must not contain D (D blocked A)
        const itemsForA = await collectAll(app, tokenA, '/users/browse', 1);
        expect(itemsForA.map(u => String(u._id))).not.toContain(idD);

        // D's browse must not contain A (D blocked A)
        const itemsForD = await collectAll(app, tokenD, '/users/browse', 1);
        expect(itemsForD.map(u => String(u._id))).not.toContain(idA);

        // Cleanup
        await request(app).patch(`/users/${idA}/block`).set('auth-token', tokenD);
    });

    it('malformed cursor → 400', async () => {
        const res = await request(app)
            .get('/users/browse?cursor=garbage')
            .set('auth-token', tokenA);
        expect(res.status).toBe(400);
    });
});

// ─── GET /users/:id/followers ───────────────────────────────────────────────

describe('GET /users/:id/followers', () => {
    it('requires authentication', async () => {
        const res = await request(app).get(`/users/${idB}/followers`);
        expect(res.status).toBe(401);
    });

    it('returns { items, nextCursor } shape', async () => {
        // B has followers (A, C)
        const res = await request(app)
            .get(`/users/${idB}/followers`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
    });

    it('includes expected followers', async () => {
        const res = await request(app)
            .get(`/users/${idB}/followers`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(u => String(u._id));
        // A and C both follow B
        expect(ids).toContain(idA);
        expect(ids).toContain(idC);
    });

    it('malformed cursor → 400', async () => {
        const res = await request(app)
            .get(`/users/${idB}/followers?cursor=bad`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(400);
    });

    it('returns 404 if target profile is hidden (blocked either way)', async () => {
        // A blocks C
        await request(app).patch(`/users/${idC}/block`).set('auth-token', tokenA);

        // A cannot see C's followers
        const res = await request(app)
            .get(`/users/${idC}/followers`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(404);

        // Cleanup
        await request(app).patch(`/users/${idC}/block`).set('auth-token', tokenA);
    });

    it('block-aware: blocked follower excluded from the list', async () => {
        // A blocks C, then views B's followers — C must not appear
        await request(app).patch(`/users/${idC}/block`).set('auth-token', tokenA);

        const res = await request(app)
            .get(`/users/${idB}/followers`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.items.map(u => String(u._id))).not.toContain(idC);

        // Cleanup
        await request(app).patch(`/users/${idC}/block`).set('auth-token', tokenA);
    });
});

// ─── GET /users/:id/following ───────────────────────────────────────────────

describe('GET /users/:id/following', () => {
    it('requires authentication', async () => {
        const res = await request(app).get(`/users/${idA}/following`);
        expect(res.status).toBe(401);
    });

    it('returns { items, nextCursor } shape', async () => {
        // A follows B
        const res = await request(app)
            .get(`/users/${idA}/following`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
    });

    it('includes expected following', async () => {
        const res = await request(app)
            .get(`/users/${idA}/following`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(u => String(u._id));
        // A follows B
        expect(ids).toContain(idB);
    });

    it('malformed cursor → 400', async () => {
        const res = await request(app)
            .get(`/users/${idA}/following?cursor=bad`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(400);
    });

    it('returns 404 if target profile is hidden (blocked either way)', async () => {
        // A blocks C
        await request(app).patch(`/users/${idC}/block`).set('auth-token', tokenA);

        // A cannot see C's following
        const res = await request(app)
            .get(`/users/${idC}/following`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(404);

        // Cleanup
        await request(app).patch(`/users/${idC}/block`).set('auth-token', tokenA);
    });

    it('returns empty when user follows nobody', async () => {
        // D follows nobody
        const res = await request(app)
            .get(`/users/${idD}/following`)
            .set('auth-token', tokenD);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(0);
        expect(res.body.nextCursor).toBeNull();
    });
});

// ─── GET /cards/:id/comments ────────────────────────────────────────────────

describe('GET /cards/:id/comments', () => {
    it('requires authentication', async () => {
        const res = await request(app).get(`/cards/${bCardIds[0]}/comments`);
        expect(res.status).toBe(401);
    });

    it('returns { items, nextCursor } shape', async () => {
        const res = await request(app)
            .get(`/cards/${bCardIds[0]}/comments`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
    });

    it('returns all 3 comments', async () => {
        const res = await request(app)
            .get(`/cards/${bCardIds[0]}/comments`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(3);
    });

    it('honors limit and returns nextCursor when more remain', async () => {
        const res = await request(app)
            .get(`/cards/${bCardIds[0]}/comments?limit=2`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(2);
        expect(typeof res.body.nextCursor).toBe('string');
    });

    it('paging through with limit=1 yields no duplicates and covers all 3 comments', async () => {
        const items = await collectAll(app, tokenA, `/cards/${bCardIds[0]}/comments`, 1);
        expect(items.length).toBe(3);
        const commentIds = items.map(c => String(c._id));
        const unique = new Set(commentIds);
        expect(unique.size).toBe(3);
    });

    it('block-aware: comments by blocked user excluded', async () => {
        // A blocks C; C commented on bCardIds[0]
        await request(app).patch(`/users/${idC}/block`).set('auth-token', tokenA);

        const res = await request(app)
            .get(`/cards/${bCardIds[0]}/comments`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        // C's comment must not appear
        const authorIds = res.body.items.map(c => String(c.userId));
        expect(authorIds).not.toContain(idC);

        // Cleanup
        await request(app).patch(`/users/${idC}/block`).set('auth-token', tokenA);
    });

    it('returns 404 for non-existent card', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .get(`/cards/${fakeId}/comments`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(404);
    });

    it('malformed cursor → 400', async () => {
        const res = await request(app)
            .get(`/cards/${bCardIds[0]}/comments?cursor=bad-cursor`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(400);
    });
});
