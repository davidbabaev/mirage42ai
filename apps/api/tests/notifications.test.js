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

let mongoServer;
let app;

const userAlice = {
    name: 'Alice',
    lastName: 'Aaron',
    email: 'notif-alice@example.com',
    password: 'Password1!',
    phone: '0501234567',
    age: 30,
    birthDate: '1995-06-15',
    address: {},
};

const userBob = {
    name: 'Bob',
    lastName: 'Brown',
    email: 'notif-bob@example.com',
    password: 'Password1!',
    phone: '0507654321',
    age: 28,
    birthDate: '1996-01-01',
    address: {},
};

let tokenAlice;
let tokenBob;
let aliceId;

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

    const aliceReg = await request(app).post('/users').send(userAlice);
    tokenAlice = aliceReg.body.token;
    aliceId = aliceReg.body.safeUser._id;
    const bobReg = await request(app).post('/users').send(userBob);
    tokenBob = bobReg.body.token;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('comment-like / comment-reply notifications carry commentId', () => {
    it('comment-like notification includes the comment _id as commentId', async () => {
        // Bob creates a card with a comment.
        const cardRes = await request(app)
            .post('/cards')
            .set('auth-token', tokenBob)
            .field('content', 'Bob card for comment-like commentId test')
            .attach('media', Buffer.from('img'), { filename: 'b2.png', contentType: 'image/png' });
        expect(cardRes.status).toBe(200);
        const cardId = cardRes.body._id;

        // Bob adds a comment to his own card.
        const commentRes = await request(app)
            .patch(`/cards/${cardId}/comments`)
            .set('auth-token', tokenBob)
            .send({ commentText: 'Test comment for like' });
        expect(commentRes.status).toBe(200);
        const comments = commentRes.body.comments || [];
        const commentId = comments[comments.length - 1]?._id;
        expect(commentId).toBeTruthy();

        // Alice likes Bob's comment → creates a comment-like notification.
        const likeRes = await request(app)
            .patch(`/cards/${cardId}/comments/${commentId}/like`)
            .set('auth-token', tokenAlice);
        expect(likeRes.status).toBe(200);

        // Bob fetches his notifications — the comment-like notif must carry commentId.
        const notifsRes = await request(app)
            .get('/notifications')
            .set('auth-token', tokenBob);
        expect(notifsRes.status).toBe(200);
        const notif = notifsRes.body.items.find(n => n.actionType === 'comment-like');
        expect(notif).toBeTruthy();
        expect(notif.commentId).toBeTruthy();
        expect(String(notif.commentId)).toBe(String(commentId));
    });

    it('comment-reply notification includes the parent comment _id as commentId', async () => {
        // Alice creates a card.
        const cardRes = await request(app)
            .post('/cards')
            .set('auth-token', tokenAlice)
            .field('content', 'Alice card for comment-reply commentId test')
            .attach('media', Buffer.from('img'), { filename: 'a2.png', contentType: 'image/png' });
        expect(cardRes.status).toBe(200);
        const cardId = cardRes.body._id;

        // Alice adds a comment.
        const commentRes = await request(app)
            .patch(`/cards/${cardId}/comments`)
            .set('auth-token', tokenAlice)
            .send({ commentText: 'Parent comment for reply test' });
        expect(commentRes.status).toBe(200);
        const aliceComments = commentRes.body.comments || [];
        const commentId = aliceComments[aliceComments.length - 1]?._id;
        expect(commentId).toBeTruthy();

        // Bob replies to Alice's comment → creates a comment-reply notification.
        const replyRes = await request(app)
            .patch(`/cards/${cardId}/comments/${commentId}/replies`)
            .set('auth-token', tokenBob)
            .send({ replyText: 'Bob reply' });
        expect(replyRes.status).toBe(200);

        // Alice fetches her notifications — the comment-reply notif must carry commentId.
        const notifsRes = await request(app)
            .get('/notifications')
            .set('auth-token', tokenAlice);
        expect(notifsRes.status).toBe(200);
        const notif = notifsRes.body.items.find(n => n.actionType === 'comment-reply');
        expect(notif).toBeTruthy();
        expect(notif.commentId).toBeTruthy();
        expect(String(notif.commentId)).toBe(String(commentId));
    });
});

describe('notifications embed the sender user (no global users scan needed)', () => {
    it('attaches sender { _id, name, lastName, profilePicture } from the fromUser', async () => {
        // Bob creates a card; Alice likes it → Bob gets a like notification.
        const cardRes = await request(app)
            .post('/cards')
            .set('auth-token', tokenBob)
            .field('content', 'Bob card for sender-embed test')
            .attach('media', Buffer.from('img'), { filename: 'bsender.png', contentType: 'image/png' });
        expect(cardRes.status).toBe(200);
        const likeRes = await request(app)
            .patch(`/cards/${cardRes.body._id}`)
            .set('auth-token', tokenAlice);
        expect(likeRes.status).toBe(200);

        const notifsRes = await request(app).get('/notifications').set('auth-token', tokenBob);
        expect(notifsRes.status).toBe(200);
        const notif = notifsRes.body.items.find(n => n.actionType === 'like' && String(n.fromUser) === String(aliceId));
        expect(notif).toBeTruthy();
        expect(notif.sender).toBeTruthy();
        expect(String(notif.sender._id)).toBe(String(aliceId));
        // registration lowercases names — compare case-insensitively
        expect(notif.sender.name.toLowerCase()).toBe('alice');
        expect(notif.sender.lastName.toLowerCase()).toBe('aaron');
        expect(notif.sender).toHaveProperty('profilePicture');
    });

    it('sender is null for a system notification with no fromUser (moderator hidden)', async () => {
        // Bob creates a card, then an admin bans it → Bob gets a post-removed
        // notification with fromUser null (moderator identity hidden).
        const User = requireFromHere(path.join(__dirname, '../src/users/models/User'));
        const cardRes = await request(app)
            .post('/cards')
            .set('auth-token', tokenBob)
            .field('content', 'Bob card to be banned')
            .attach('media', Buffer.from('img'), { filename: 'bban.png', contentType: 'image/png' });
        const cardId = cardRes.body._id;
        // Promote Alice to admin so she can ban.
        await User.findByIdAndUpdate(aliceId, { isAdmin: true });
        const banRes = await request(app).patch(`/cards/${cardId}/ban`).set('auth-token', tokenAlice);
        expect(banRes.status).toBe(200);
        await User.findByIdAndUpdate(aliceId, { isAdmin: false });

        const notifsRes = await request(app).get('/notifications').set('auth-token', tokenBob);
        const removed = notifsRes.body.items.find(n => n.actionType === 'post-removed');
        expect(removed).toBeTruthy();
        expect(removed.fromUser == null).toBe(true);
        expect(removed.sender).toBeNull();
    });
});

describe('DELETE /notifications/:id auth boundary', () => {
    it('returns 403 (does not hang) when a user tries to delete a notification not addressed to them', async () => {
        // Bob creates a card.
        const cardRes = await request(app)
            .post('/cards')
            .set('auth-token', tokenBob)
            .field('content', 'Bob test card for notification flow')
            .attach('media', Buffer.from('img'), {
                filename: 'b.png',
                contentType: 'image/png',
            });
        expect(cardRes.status).toBe(200);
        const bobCardId = cardRes.body._id;

        // Alice likes Bob's card → creates a notification with toUser = Bob.
        const likeRes = await request(app)
            .patch(`/cards/${bobCardId}`)
            .set('auth-token', tokenAlice);
        expect(likeRes.status).toBe(200);

        // Bob fetches his notifications to grab the new notification's id.
        const notifsRes = await request(app)
            .get('/notifications')
            .set('auth-token', tokenBob);
        expect(notifsRes.status).toBe(200);
        expect(Array.isArray(notifsRes.body.items)).toBe(true);
        const notif = notifsRes.body.items.find(n => n.actionType === 'like');
        expect(notif).toBeTruthy();
        const notifId = notif._id;

        // Alice (the fromUser, NOT the toUser) attempts to delete Bob's notification.
        // Pre-fix: the route's `if` is false and there's no `else`, so res.send() is
        // never called and the connection hangs. .timeout(3000) makes the test fail
        // fast with a timeout error rather than hanging until vitest's overall
        // testTimeout. Post-fix: the route responds 403.
        const delRes = await request(app)
            .delete(`/notifications/${notifId}`)
            .set('auth-token', tokenAlice)
            .timeout(3000);
        expect(delRes.status).toBe(403);
    });
});
