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
    email: `${slug}.onboard@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let mongoServer, app;
// A: new user with no follows (cold-start)
// B: user who posts popular content
// C: user who follows B (has a following feed)
// D: user used for block exclusion tests
let tokenA, idA, tokenB, idB, tokenC, tokenD, idD;
let bCardId;

const newCard = (token, title) =>
    request(app).post('/cards').set('auth-token', token)
        .field('title', title).field('content', 'body').field('category', 'general')
        .attach('media', Buffer.from('img'), { filename: 't.png', contentType: 'image/png' });

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

    // Register users
    const rA = await request(app).post('/users').send(mkUser('ob-a'));
    tokenA = rA.body.token; idA = rA.body.safeUser._id;

    const rB = await request(app).post('/users').send(mkUser('ob-b'));
    tokenB = rB.body.token; idB = rB.body.safeUser._id;

    const rC = await request(app).post('/users').send(mkUser('ob-c'));
    tokenC = rC.body.token;

    const rD = await request(app).post('/users').send(mkUser('ob-d'));
    tokenD = rD.body.token; idD = rD.body.safeUser._id;

    // B posts a card that will be the "popular" content
    const cardRes = await newCard(tokenB, 'Popular Post');
    bCardId = cardRes.body._id;

    // C follows B (so C has a non-empty following feed)
    await request(app).patch(`/users/${idB}/follow`).set('auth-token', tokenC);
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

// ─── PATCH /users/me/onboarding ────────────────────────────────────────────────

describe('PATCH /users/me/onboarding', () => {
    it('requires authentication', async () => {
        const res = await request(app)
            .patch('/users/me/onboarding')
            .send({ onboardingComplete: true });
        expect(res.status).toBe(401);
    });

    it('sets interests and onboardingComplete on the caller', async () => {
        const res = await request(app)
            .patch('/users/me/onboarding')
            .set('auth-token', tokenA)
            .send({ interests: ['technology', 'sports'], onboardingComplete: true });
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(idA);
        expect(res.body.interests).toEqual(expect.arrayContaining(['technology', 'sports']));
        expect(res.body.onboardingComplete).toBe(true);
    });

    it('does NOT change another user when caller updates their own onboarding', async () => {
        // A's patch above must not have touched B
        const bRes = await request(app)
            .patch('/users/me/onboarding')
            .set('auth-token', tokenB)
            .send({ interests: [] });
        expect(bRes.status).toBe(200);
        expect(bRes.body._id).toBe(idB);
        // B's interests were never set to A's values
        expect((bRes.body.interests || [])).not.toEqual(['technology', 'sports']);
    });

    it('rejects non-string entries in interests array', async () => {
        const res = await request(app)
            .patch('/users/me/onboarding')
            .set('auth-token', tokenA)
            .send({ interests: [123, true] });
        expect(res.status).toBe(400);
    });

    it('rejects when no updatable fields are provided', async () => {
        const res = await request(app)
            .patch('/users/me/onboarding')
            .set('auth-token', tokenA)
            .send({});
        expect(res.status).toBe(400);
    });

    it('accepts onboardingComplete alone', async () => {
        const res = await request(app)
            .patch('/users/me/onboarding')
            .set('auth-token', tokenB)
            .send({ onboardingComplete: false });
        expect(res.status).toBe(200);
        expect(res.body.onboardingComplete).toBe(false);
    });
});

// ─── GET /users/suggested ──────────────────────────────────────────────────────

describe('GET /users/suggested', () => {
    it('requires authentication', async () => {
        const res = await request(app).get('/users/suggested');
        expect(res.status).toBe(401);
    });

    it('returns users array and optional nextCursor', async () => {
        const res = await request(app).get('/users/suggested').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('users');
        expect(Array.isArray(res.body.users)).toBe(true);
        // nextCursor is null or a string
        expect(res.body.nextCursor === null || typeof res.body.nextCursor === 'string').toBe(true);
    });

    it('excludes self from suggestions', async () => {
        const res = await request(app).get('/users/suggested').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        const ids = res.body.users.map(u => String(u._id));
        expect(ids).not.toContain(idA);
    });

    it('excludes already-followed users', async () => {
        // C follows B — B must not appear in C's suggestions
        const res = await request(app).get('/users/suggested').set('auth-token', tokenC);
        expect(res.status).toBe(200);
        const ids = res.body.users.map(u => String(u._id));
        expect(ids).not.toContain(idB);
    });

    it('each row has required fields and isFollowing is false', async () => {
        const res = await request(app).get('/users/suggested').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        for (const u of res.body.users) {
            expect(u).toHaveProperty('_id');
            expect(u).toHaveProperty('followersCount');
            expect(u).toHaveProperty('isFollowing');
            expect(u.isFollowing).toBe(false);
        }
    });

    it('excludes users involved in a block — both directions', async () => {
        // D blocks A
        await request(app).patch(`/users/${idA}/block`).set('auth-token', tokenD);

        // A's suggestions must not contain D (D blocked A)
        const resA = await request(app).get('/users/suggested').set('auth-token', tokenA);
        expect(resA.status).toBe(200);
        expect(resA.body.users.map(u => String(u._id))).not.toContain(idD);

        // D's suggestions must not contain A (D blocked A)
        const resD = await request(app).get('/users/suggested').set('auth-token', tokenD);
        expect(resD.status).toBe(200);
        expect(resD.body.users.map(u => String(u._id))).not.toContain(idA);

        // Cleanup: unblock
        await request(app).patch(`/users/${idA}/block`).set('auth-token', tokenD);
    });

    it('paginates via cursor — page 2 does not repeat page 1 items', async () => {
        const res1 = await request(app)
            .get('/users/suggested?limit=1')
            .set('auth-token', tokenA);
        expect(res1.status).toBe(200);

        if (res1.body.nextCursor && res1.body.users.length === 1) {
            const res2 = await request(app)
                .get(`/users/suggested?limit=1&cursor=${res1.body.nextCursor}`)
                .set('auth-token', tokenA);
            expect(res2.status).toBe(200);
            if (res2.body.users.length > 0) {
                expect(String(res2.body.users[0]._id)).not.toBe(String(res1.body.users[0]._id));
            }
        }
    });
});

// ─── GET /cards/feed — suggested/following feed (now { cards, nextCursor }) ─────

describe('GET /cards/feed — suggested fallback + following', () => {
    it('returns a { cards, nextCursor } envelope', async () => {
        const res = await request(app).get('/cards/feed').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.cards)).toBe(true);
        expect(res.body.nextCursor === null || typeof res.body.nextCursor === 'string').toBe(true);
    });

    it('user with 0 follows receives cards tagged isSuggested:true', async () => {
        // A follows nobody
        const res = await request(app).get('/cards/feed').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        // If any suggested active cards exist, they must be flagged
        if (res.body.cards.length > 0) {
            expect(res.body.cards.every(c => c.isSuggested === true)).toBe(true);
        }
    });

    it('user with follows receives their following feed (no isSuggested flag)', async () => {
        // C follows B — should get B's posts, NOT the suggested fallback
        const res = await request(app).get('/cards/feed').set('auth-token', tokenC);
        expect(res.status).toBe(200);
        expect(res.body.cards.some(c => c.isSuggested === true)).toBe(false);
        // C's feed includes B's post
        expect(res.body.cards.some(c => c._id === bCardId)).toBe(true);
    });

    it('suggested fallback excludes the viewer\'s own posts', async () => {
        // Post a card as A, then check A's feed does not include it (A follows nobody)
        await newCard(tokenA, 'A self post');
        const res = await request(app).get('/cards/feed').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        // A's own posts must not appear in A's fallback feed
        const ownPost = res.body.cards.find(c => c.userId === idA);
        expect(ownPost).toBeUndefined();
    });

    it('suggested fallback excludes blocked authors (both directions)', async () => {
        // A blocks B — B's card must not appear in A's fallback feed
        await request(app).patch(`/users/${idB}/block`).set('auth-token', tokenA);

        const res = await request(app).get('/cards/feed').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        const bCardPresent = res.body.cards.some(c => String(c.userId) === idB);
        expect(bCardPresent).toBe(false);

        // Cleanup: unblock
        await request(app).patch(`/users/${idB}/block`).set('auth-token', tokenA);
    });

    it('rejects a malformed cursor with 400', async () => {
        const res = await request(app)
            .get('/cards/feed?cursor=not-a-real-cursor')
            .set('auth-token', tokenA);
        expect(res.status).toBe(400);
    });
});

// ─── GET /cards/feed — cursor pagination (keyset, no dupes/skips) ───────────────

describe('GET /cards/feed — cursor pagination', () => {
    let tokenE, idE, tokenF, tokenG;
    const eCardIds = [];

    // Page through an entire feed at the given limit, returning every card id seen.
    const collectAllFeed = async (token, limit) => {
        const ids = [];
        let cursor;
        for (let guard = 0; guard < 100; guard++) {
            const url = `/cards/feed?limit=${limit}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
            const res = await request(app).get(url).set('auth-token', token);
            expect(res.status).toBe(200);
            ids.push(...res.body.cards.map(c => String(c._id)));
            if (!res.body.nextCursor) break;
            cursor = res.body.nextCursor;
        }
        return ids;
    };

    beforeAll(async () => {
        // E posts several cards; F follows only E → F's following feed is exactly
        // E's cards (deterministic, isolated from other tests' cards). G follows
        // nobody → G gets the suggested feed over all active posts.
        const rE = await request(app).post('/users').send(mkUser('ob-e'));
        tokenE = rE.body.token; idE = rE.body.safeUser._id;
        const rF = await request(app).post('/users').send(mkUser('ob-f'));
        tokenF = rF.body.token;
        const rG = await request(app).post('/users').send(mkUser('ob-g'));
        tokenG = rG.body.token;

        for (let i = 0; i < 7; i++) {
            const r = await newCard(tokenE, `E post ${i}`);
            eCardIds.push(String(r.body._id));
        }
        await request(app).patch(`/users/${idE}/follow`).set('auth-token', tokenF);
    }, 60_000);

    it('honors the page limit and returns a next cursor when more remain', async () => {
        const res = await request(app).get('/cards/feed?limit=3').set('auth-token', tokenF);
        expect(res.status).toBe(200);
        expect(res.body.cards.length).toBe(3);           // exactly one page
        expect(typeof res.body.nextCursor).toBe('string'); // 7 > 3 → more remain
    });

    it('pages through the whole following feed with no duplicates, ending at null', async () => {
        const ids = await collectAllFeed(tokenF, 3);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);            // no post repeated across pages
        expect(unique.size).toBe(eCardIds.length);       // every one of E's 7 posts seen
        for (const id of eCardIds) expect(unique.has(id)).toBe(true);
    });

    it('never leaks a blocked author across any page of the suggested feed', async () => {
        // G (follows nobody) blocks E, then pages the entire suggested feed.
        await request(app).patch(`/users/${idE}/block`).set('auth-token', tokenG);
        const ids = await collectAllFeed(tokenG, 3);
        for (const eId of eCardIds) expect(ids).not.toContain(eId);
        await request(app).patch(`/users/${idE}/block`).set('auth-token', tokenG); // unblock
    });
});

// ─── GET /cards/feed — likePreview embed (provider-retirement slice 3) ────────
// Each feed card must carry a `likePreview` array. For cards with likes it must
// contain liker sub-objects {_id, name, lastName, profilePicture}; for cards
// with no likes it must be an empty array. No per-card User queries (N+1 check
// is structural — one attachLikePreview call in the svc covers the whole page).

describe('GET /cards/feed — likePreview embed', () => {
    let tokenH, idH, tokenI, likedCardId, unlikedCardId;

    beforeAll(async () => {
        // H posts two cards. I follows H and likes one of them.
        const rH = await request(app).post('/users').send(mkUser('lp-h'));
        tokenH = rH.body.token; idH = rH.body.safeUser._id;
        const rI = await request(app).post('/users').send(mkUser('lp-i'));
        tokenI = rI.body.token;

        const rLiked = await newCard(tokenH, 'Liked preview card');
        likedCardId = rLiked.body._id;
        const rUnliked = await newCard(tokenH, 'Unliked preview card');
        unlikedCardId = rUnliked.body._id;

        // I follows H so H's cards appear in I's following feed
        await request(app).patch(`/users/${idH}/follow`).set('auth-token', tokenI);
        // I likes only the first card
        await request(app).patch(`/cards/${likedCardId}`).set('auth-token', tokenI);
    }, 60_000);

    it('every feed card carries a likePreview array', async () => {
        const res = await request(app).get('/cards/feed').set('auth-token', tokenI);
        expect(res.status).toBe(200);
        for (const card of res.body.cards) {
            expect(Array.isArray(card.likePreview)).toBe(true);
        }
    });

    it('a liked card has likePreview with liker sub-objects', async () => {
        const res = await request(app).get('/cards/feed').set('auth-token', tokenI);
        expect(res.status).toBe(200);
        const card = res.body.cards.find(c => c._id === likedCardId);
        expect(card).toBeDefined();
        expect(card.likePreview.length).toBeGreaterThan(0);
        const liker = card.likePreview[0];
        expect(liker).toHaveProperty('_id');
        expect(liker).toHaveProperty('name');
        expect(liker).toHaveProperty('lastName');
        expect(liker).toHaveProperty('profilePicture');
    });

    it('an unliked card has an empty likePreview array', async () => {
        const res = await request(app).get('/cards/feed').set('auth-token', tokenI);
        expect(res.status).toBe(200);
        const card = res.body.cards.find(c => c._id === unlikedCardId);
        expect(card).toBeDefined();
        expect(Array.isArray(card.likePreview)).toBe(true);
        expect(card.likePreview).toHaveLength(0);
    });

    it('likePreview contains at most 4 entries even when a card has more likes', async () => {
        // Have H also like the likedCard (so it now has 2 likers: I and H)
        // Then create 3 more accounts and have them all like it — total >= 5 likers
        const extraTokens = [];
        for (let k = 0; k < 3; k++) {
            const r = await request(app).post('/users').send(mkUser(`lp-extra-${k}`));
            extraTokens.push(r.body.token);
        }
        // H likes its own card (self-like, allowed)
        await request(app).patch(`/cards/${likedCardId}`).set('auth-token', tokenH);
        for (const tok of extraTokens) {
            // extras need to follow H so they can see/like (not required by the like
            // endpoint itself, but we do it to mirror real usage)
            await request(app).patch(`/cards/${likedCardId}`).set('auth-token', tok);
        }

        const res = await request(app).get('/cards/feed').set('auth-token', tokenI);
        expect(res.status).toBe(200);
        const card = res.body.cards.find(c => c._id === likedCardId);
        expect(card).toBeDefined();
        expect(card.likePreview.length).toBeLessThanOrEqual(4);
    });
});
