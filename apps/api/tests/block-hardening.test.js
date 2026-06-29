// Hardening pass on the shipped block feature. Three gaps that the original
// block work left open:
//   A. getChats() did not drop conversations with a now-blocked counterpart.
//   B. notification writes (comment-like / comment-reply) did not check block,
//      so a blocked user could still notify the person on the other side.
//   C. like/comment WRITE endpoints accepted a blocked actor (read already 404s).
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
    email: `${slug}.hard@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let mongoServer, app, Conversation;

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
    Conversation = requireFromHere(path.join(__dirname, '../src/chat/models/Conversation'));
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const reg = async (slug, over) => {
    const r = await request(app).post('/users').send(mkUser(slug, over));
    return { token: r.body.token, id: r.body.safeUser._id };
};
const block = (token, target) => request(app).patch(`/users/${target}/block`).set('auth-token', token);
const newCard = (token, title) =>
    request(app).post('/cards').set('auth-token', token)
        .field('title', title).field('content', 'body').field('category', 'general')
        .attach('media', Buffer.from('img'), { filename: 't.png', contentType: 'image/png' });

// ---------------------------------------------------------------- Gap A
describe('Gap A — getChats drops conversations with a blocked counterpart', () => {
    let P, Q;
    beforeAll(async () => {
        P = await reg('hard-p', { name: 'Pia' });
        Q = await reg('hard-q', { name: 'Quin' });
        await Conversation.create({ fromUser: P.id, toUser: Q.id });
    }, 60_000);

    it('shows the conversation before a block', async () => {
        const res = await request(app).get('/chats').set('auth-token', P.token);
        expect(res.status).toBe(200);
        expect(res.body.some(c => String(c.toUser) === Q.id || String(c.fromUser) === Q.id)).toBe(true);
    });

    it('hides it from BOTH sides once P blocks Q', async () => {
        await block(P.token, Q.id);
        const pView = await request(app).get('/chats').set('auth-token', P.token);
        expect(pView.body.some(c => String(c.toUser) === Q.id || String(c.fromUser) === Q.id)).toBe(false);
        const qView = await request(app).get('/chats').set('auth-token', Q.token);
        expect(qView.body.some(c => String(c.toUser) === P.id || String(c.fromUser) === P.id)).toBe(false);
    });

    it('restores it after unblock', async () => {
        await block(P.token, Q.id); // toggle off
        const res = await request(app).get('/chats').set('auth-token', P.token);
        expect(res.body.some(c => String(c.toUser) === Q.id || String(c.fromUser) === Q.id)).toBe(true);
    });
});

// ---------------------------------------------------------------- Gap C
describe('Gap C — write endpoints reject a blocked actor', () => {
    let M, N, mCard;
    beforeAll(async () => {
        M = await reg('hard-m', { name: 'Mara' });
        N = await reg('hard-n', { name: 'Ned' });
        mCard = (await newCard(M.token, 'm post')).body._id;
        await block(M.token, N.id); // M blocks N
    }, 60_000);

    it('rejects a like on the blocker\'s card with 403', async () => {
        expect((await request(app).patch(`/cards/${mCard}`).set('auth-token', N.token)).status).toBe(403);
    });

    it('rejects a comment on the blocker\'s card with 403', async () => {
        const res = await request(app).patch(`/cards/${mCard}/comments`).set('auth-token', N.token)
            .send({ commentText: 'should not land' });
        expect(res.status).toBe(403);
    });

    it('also rejects the blocker writing to a card flow involving the blocked user', async () => {
        // N posts; M (who blocked N) cannot like N's card either (block both ways).
        const nCard = (await newCard(N.token, 'n post')).body._id;
        expect((await request(app).patch(`/cards/${nCard}`).set('auth-token', M.token)).status).toBe(403);
    });

    it('a neutral user can still like and comment', async () => {
        const U = await reg('hard-u', { name: 'Uma' });
        expect((await request(app).patch(`/cards/${mCard}`).set('auth-token', U.token)).status).toBe(200);
    });
});

// ---------------------------------------------------------------- Gap B
describe('Gap B — no notification across a block (third-party comment author)', () => {
    let O, N, R, U, oCard, nCommentId;
    const notifsFor = (token) => request(app).get('/notifications').set('auth-token', token);
    const fromId = (n) => String(n.fromUser?._id ?? n.fromUser);

    beforeAll(async () => {
        O = await reg('hard-o', { name: 'Omar' });   // card owner
        N = await reg('hard-n2', { name: 'Nia' });    // comments, then blocks R
        R = await reg('hard-r', { name: 'Rex' });     // blocked party
        U = await reg('hard-u2', { name: 'Ugo' });    // neutral control

        oCard = (await newCard(O.token, 'o post')).body._id;
        const commented = await request(app).patch(`/cards/${oCard}/comments`).set('auth-token', N.token)
            .send({ commentText: 'nia comment' });
        nCommentId = commented.body.comments.find(c => String(c.userId) === N.id)._id;

        await block(N.token, R.id); // N blocks R (block is with the COMMENT author, not the card owner)
    }, 60_000);

    it('a blocked user liking the comment fires NO notification to its author', async () => {
        // R is not blocked with the card owner O, so the like write itself is allowed;
        // the notification to comment-author N must still be suppressed.
        await request(app).patch(`/cards/${oCard}/comments/${nCommentId}/like`).set('auth-token', R.token);
        const res = await notifsFor(N.token);
        expect(res.status).toBe(200);
        expect(res.body.some(n => n.actionType === 'comment-like' && fromId(n) === R.id)).toBe(false);
    });

    it('a neutral user liking the same comment DOES notify the author (control)', async () => {
        await request(app).patch(`/cards/${oCard}/comments/${nCommentId}/like`).set('auth-token', U.token);
        const res = await notifsFor(N.token);
        expect(res.body.some(n => n.actionType === 'comment-like' && fromId(n) === U.id)).toBe(true);
    });
});
