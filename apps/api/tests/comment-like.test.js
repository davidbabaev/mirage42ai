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

const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.commentlike@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let tokenA, tokenB, userAId, userBId, cardId, commentId;

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

    // A owns the card; B is the comment author whom likes should notify.
    const regA = await request(app).post('/users').send(mkUser('clike-a'));
    tokenA = regA.body.token; userAId = regA.body.safeUser._id;
    const regB = await request(app).post('/users').send(mkUser('clike-b'));
    tokenB = regB.body.token; userBId = regB.body.safeUser._id;

    const card = await request(app)
        .post('/cards').set('auth-token', tokenA)
        .field('title', 'Card').field('content', 'body').field('category', 'general')
        .attach('media', Buffer.from('fake-image-bytes'), { filename: 't.png', contentType: 'image/png' });
    cardId = card.body._id;

    // B comments on A's card.
    const commented = await request(app)
        .patch(`/cards/${cardId}/comments`).set('auth-token', tokenB)
        .send({ commentText: 'Bob comment' });
    commentId = commented.body.comments.find(c => c.commentText === 'Bob comment')._id;
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const likeComment = (token) =>
    request(app).patch(`/cards/${cardId}/comments/${commentId}/like`).set('auth-token', token);
const Notification = () => mongoose.model('Notification');
const commentFrom = (res) => res.body.comments.find(c => c._id === commentId);

describe('like a comment (PATCH /cards/:id/comments/:commentId/like)', () => {
    it('requires authentication', async () => {
        const res = await request(app).patch(`/cards/${cardId}/comments/${commentId}/like`);
        expect(res.status).toBe(401);
    });

    it('A liking B\'s comment adds A to the comment likes and notifies B (the comment author)', async () => {
        await Notification().deleteMany({ fromUser: userAId, toUser: userBId, actionType: 'comment-like' });

        const res = await likeComment(tokenA);
        expect(res.status).toBe(200);
        expect(commentFrom(res).likes).toContain(userAId);

        const notifs = await Notification().countDocuments({
            actionType: 'comment-like', fromUser: userAId, toUser: userBId,
        });
        expect(notifs).toBe(1);
    });

    it('toggles off: A liking again removes A and creates no new notification', async () => {
        await Notification().deleteMany({ fromUser: userAId, toUser: userBId, actionType: 'comment-like' });

        const res = await likeComment(tokenA); // already liked -> unlike
        expect(res.status).toBe(200);
        expect(commentFrom(res).likes).not.toContain(userAId);

        const notifs = await Notification().countDocuments({
            actionType: 'comment-like', fromUser: userAId, toUser: userBId,
        });
        expect(notifs).toBe(0);
    });

    it('liking your OWN comment does not create a self-notification', async () => {
        await Notification().deleteMany({ toUser: userBId, actionType: 'comment-like' });

        const res = await likeComment(tokenB); // B likes B's own comment
        expect(res.status).toBe(200);
        expect(commentFrom(res).likes).toContain(userBId);

        const notifs = await Notification().countDocuments({
            actionType: 'comment-like', toUser: userBId,
        });
        expect(notifs).toBe(0);
    });

    it('404s for a non-existent comment id', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .patch(`/cards/${cardId}/comments/${fakeId}/like`).set('auth-token', tokenA);
        expect(res.status).toBe(404);
    });
});
