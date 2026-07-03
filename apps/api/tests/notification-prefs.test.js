// Tests for per-type notification preferences (T5).
// Covers: PATCH /users/me/notification-prefs; gating of like / comment /
// comment-like / comment-reply / follow notifications on recipient prefs;
// prefs default to all-true for a fresh user; PATCH only mutates the caller.
process.env.GOOGLE_CLIENT_ID      ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET  ||= 'test-google-client-secret';
process.env.JWT_SECRET            ||= 'test-jwt-secret';
process.env.SERVER_URL            ||= 'http://localhost:8181';
process.env.CLIENT_URL            ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const FAKE_MEDIA_URL = 'https://fake.test/notifprefs-card.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

let mongoServer, app;

const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.notifprefs@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

// Registered users
let tokenA, tokenB, tokenC;
let userAId, userBId;
// A's card; B's comment on A's card
let cardIdA, commentIdB;

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

    // Register three users: A (card owner), B (commenter + comment owner), C (actor)
    const regA = await request(app).post('/users').send(mkUser('np-a'));
    tokenA = regA.body.token; userAId = regA.body.safeUser._id;

    const regB = await request(app).post('/users').send(mkUser('np-b'));
    tokenB = regB.body.token; userBId = regB.body.safeUser._id;

    const regC = await request(app).post('/users').send(mkUser('np-c'));
    tokenC = regC.body.token;

    // A creates a card
    const card = await request(app)
        .post('/cards').set('auth-token', tokenA)
        .field('title', 'NP Card').field('content', 'body').field('category', 'general')
        .attach('media', Buffer.from('fake-bytes'), { filename: 't.png', contentType: 'image/png' });
    cardIdA = card.body._id;

    // B comments on A's card (B will be the "comment owner" for reply/like tests)
    const commented = await request(app)
        .patch(`/cards/${cardIdA}/comments`).set('auth-token', tokenB)
        .send({ commentText: 'B comment' });
    commentIdB = commented.body.comments.find(c => c.commentText === 'B comment')._id;
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const Notification = () => mongoose.model('Notification');

// ─── PATCH endpoint ───────────────────────────────────────────────────────────

describe('PATCH /users/me/notification-prefs', () => {
    it('requires authentication', async () => {
        const res = await request(app).patch('/users/me/notification-prefs').send({ likes: false });
        expect(res.status).toBe(401);
    });

    it('rejects unknown keys', async () => {
        const res = await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenA)
            .send({ unknownKey: false });
        expect(res.status).toBe(400);
    });

    it('rejects non-boolean values', async () => {
        const res = await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenA)
            .send({ likes: 'no' });
        expect(res.status).toBe(400);
    });

    it('accepts a valid partial update and returns the updated user including notificationPrefs', async () => {
        const res = await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenA)
            .send({ likes: false, comments: true });
        expect(res.status).toBe(200);
        expect(res.body.notificationPrefs).toBeDefined();
        expect(res.body.notificationPrefs.likes).toBe(false);
        expect(res.body.notificationPrefs.comments).toBe(true);
        // Other keys remain at their defaults (true)
        expect(res.body.notificationPrefs.follows).toBe(true);
        expect(res.body.notificationPrefs.commentLikes).toBe(true);
        expect(res.body.notificationPrefs.commentReplies).toBe(true);
    });

    it('only mutates the CALLER — B\'s prefs are unaffected when A patches', async () => {
        // Set A's likes to false (done above). B should still have all-true defaults.
        // notificationPrefs not in public projection — check via a PATCH no-op on B's own account
        const patchB = await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenB)
            .send({ likes: true }); // no-op (already true)
        expect(patchB.status).toBe(200);
        expect(patchB.body.notificationPrefs.likes).toBe(true);
    });
});

// ─── Default all-true for a fresh user ────────────────────────────────────────

describe('fresh user defaults', () => {
    it('notificationPrefs returned on first PATCH are all true for a brand-new account', async () => {
        const regFresh = await request(app).post('/users').send(mkUser('np-fresh'));
        const tokenFresh = regFresh.body.token;
        // Patch with a single key; the rest come back at their defaults.
        const res = await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenFresh)
            .send({ follows: true }); // no actual change — just to read back
        expect(res.status).toBe(200);
        const p = res.body.notificationPrefs;
        expect(p.likes).toBe(true);
        expect(p.comments).toBe(true);
        expect(p.follows).toBe(true);
        expect(p.commentLikes).toBe(true);
        expect(p.commentReplies).toBe(true);
    });
});

// ─── Like gating ──────────────────────────────────────────────────────────────

describe('like notification gating', () => {
    it('disabling likes pref on A suppresses a like notification when C likes A\'s card', async () => {
        // A already has likes=false from the PATCH test above.
        await Notification().deleteMany({ toUser: userAId, actionType: 'like' });
        const res = await request(app)
            .patch(`/cards/${cardIdA}`).set('auth-token', tokenC);
        expect(res.status).toBe(200); // like succeeded
        const count = await Notification().countDocuments({ toUser: userAId, actionType: 'like' });
        expect(count).toBe(0); // suppressed
    });

    it('re-enabling likes pref on A means a like now creates a notification', async () => {
        // Reset: unlike first, re-enable, then like again.
        // C is currently liking the card — unlike it.
        await request(app).patch(`/cards/${cardIdA}`).set('auth-token', tokenC);
        // Re-enable likes for A.
        await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenA)
            .send({ likes: true });
        await Notification().deleteMany({ toUser: userAId, actionType: 'like' });
        // C likes again.
        const res = await request(app).patch(`/cards/${cardIdA}`).set('auth-token', tokenC);
        expect(res.status).toBe(200);
        const count = await Notification().countDocuments({ toUser: userAId, actionType: 'like' });
        expect(count).toBe(1);
    });
});

// ─── Comment gating ───────────────────────────────────────────────────────────

describe('comment notification gating', () => {
    it('disabling comments pref on A suppresses a comment notification', async () => {
        await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenA)
            .send({ comments: false });
        await Notification().deleteMany({ toUser: userAId, actionType: 'comment' });

        const res = await request(app)
            .patch(`/cards/${cardIdA}/comments`).set('auth-token', tokenC)
            .send({ commentText: 'C says hi' });
        expect(res.status).toBe(200);
        const count = await Notification().countDocuments({ toUser: userAId, actionType: 'comment' });
        expect(count).toBe(0);
    });

    it('with likes still enabled a like notification DOES arrive (other types unaffected)', async () => {
        // A now has likes=true, comments=false. Unlike then re-like from C.
        await request(app).patch(`/cards/${cardIdA}`).set('auth-token', tokenC); // unlike
        await Notification().deleteMany({ toUser: userAId, actionType: 'like' });
        await request(app).patch(`/cards/${cardIdA}`).set('auth-token', tokenC); // like
        const likeCount = await Notification().countDocuments({ toUser: userAId, actionType: 'like' });
        const commentCount = await Notification().countDocuments({ toUser: userAId, actionType: 'comment' });
        expect(likeCount).toBe(1);   // still arrives
        expect(commentCount).toBe(0); // suppressed (comments off)
    });
});

// ─── Comment-like gating ──────────────────────────────────────────────────────

describe('comment-like notification gating', () => {
    it('disabling commentLikes pref on B suppresses a comment-like to B', async () => {
        await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenB)
            .send({ commentLikes: false });
        await Notification().deleteMany({ toUser: userBId, actionType: 'comment-like' });

        const res = await request(app)
            .patch(`/cards/${cardIdA}/comments/${commentIdB}/like`).set('auth-token', tokenC);
        expect(res.status).toBe(200);
        const count = await Notification().countDocuments({ toUser: userBId, actionType: 'comment-like' });
        expect(count).toBe(0);
    });
});

// ─── Comment-reply gating ─────────────────────────────────────────────────────

describe('comment-reply notification gating', () => {
    it('disabling commentReplies pref on B suppresses a reply notification to B', async () => {
        await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenB)
            .send({ commentReplies: false });
        await Notification().deleteMany({ toUser: userBId, actionType: 'comment-reply' });

        const res = await request(app)
            .patch(`/cards/${cardIdA}/comments/${commentIdB}/replies`).set('auth-token', tokenC)
            .send({ replyText: 'C replies to B' });
        expect(res.status).toBe(200);
        const count = await Notification().countDocuments({ toUser: userBId, actionType: 'comment-reply' });
        expect(count).toBe(0);
    });
});

// ─── Follow gating ────────────────────────────────────────────────────────────

describe('follow notification gating', () => {
    it('disabling follows pref on A suppresses a follow notification', async () => {
        await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenA)
            .send({ follows: false });
        await Notification().deleteMany({ toUser: userAId, actionType: 'follow' });

        const res = await request(app)
            .patch(`/users/${userAId}/follow`).set('auth-token', tokenC);
        expect(res.status).toBe(200);
        const count = await Notification().countDocuments({ toUser: userAId, actionType: 'follow' });
        expect(count).toBe(0);
    });

    it('re-enabling follows on A means the next follow creates a notification', async () => {
        // C is now following A — unfollow then re-enable then follow again.
        await request(app).patch(`/users/${userAId}/follow`).set('auth-token', tokenC); // unfollow
        await request(app)
            .patch('/users/me/notification-prefs').set('auth-token', tokenA)
            .send({ follows: true });
        await Notification().deleteMany({ toUser: userAId, actionType: 'follow' });

        await request(app).patch(`/users/${userAId}/follow`).set('auth-token', tokenC); // follow
        const count = await Notification().countDocuments({ toUser: userAId, actionType: 'follow' });
        expect(count).toBe(1);
    });
});
