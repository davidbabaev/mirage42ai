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
    name: 'Alice', lastName: 'Tester',
    email: `${slug}.creatorembed@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let tokenA, tokenB, userAId, cardId, commentId;

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

    // A owns the card (the "creator" under test); B is a second user who
    // interacts with it, so mutation responses are exercised by a NON-author.
    const regA = await request(app).post('/users').send(
        mkUser('crembed-a', { name: 'Alice', lastName: 'Poster', job: 'Photographer' })
    );
    tokenA = regA.body.token; userAId = regA.body.safeUser._id;

    const regB = await request(app).post('/users').send(
        mkUser('crembed-b', { name: 'Bob', lastName: 'Viewer' })
    );
    tokenB = regB.body.token;

    const card = await request(app)
        .post('/cards').set('auth-token', tokenA)
        .field('title', 'Creator Embed Card').field('content', 'testing creator embed').field('category', 'general')
        .attach('media', Buffer.from('fake-image-bytes'), { filename: 't.png', contentType: 'image/png' });
    cardId = card.body._id;

    const commented = await request(app)
        .patch(`/cards/${cardId}/comments`).set('auth-token', tokenB)
        .send({ commentText: 'Nice post' });
    commentId = commented.body.comments.find(c => c.commentText === 'Nice post')._id;
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

// The card author is embedded so the client never scans a global users array.
// Every field here has a render site: name/lastName (byline), profilePicture
// (avatar), job (subtitle), _id (navigate + self-post guard).
const expectCreator = (creator) => {
    expect(creator).toBeTruthy();
    expect(String(creator._id)).toBe(String(userAId));
    expect(creator.name.toLowerCase()).toBe('alice');
    expect(creator.lastName.toLowerCase()).toBe('poster');
    expect(creator).toHaveProperty('profilePicture');
    expect(creator.job).toBe('Photographer');
};

const findCard = (cards) => cards.find(c => String(c._id) === String(cardId));

describe('creator embed — read paths', () => {
    it('GET /cards embeds the post author', async () => {
        const res = await request(app).get('/cards').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(findCard(res.body).creator);
    });

    it('GET /cards/:id embeds the post author', async () => {
        const res = await request(app).get(`/cards/${cardId}`).set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(res.body.creator);
    });

    it('GET /cards/feed embeds the post author', async () => {
        // B follows nobody → cold-start "suggested" feed, which includes A's post.
        const res = await request(app).get('/cards/feed').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(findCard(res.body.cards).creator);
    });

    it('GET /cards/explore embeds the post author', async () => {
        const res = await request(app).get('/cards/explore').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(findCard(res.body.items).creator);
    });

    it('GET /cards/search embeds the post author', async () => {
        const res = await request(app).get('/cards/search?q=Creator').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(findCard(res.body.items).creator);
    });

    it('GET /users/me/favorites embeds the post author', async () => {
        const saved = await request(app)
            .post(`/users/me/favorites/${cardId}`).set('auth-token', tokenB);
        expect(saved.status).toBe(200);

        const res = await request(app).get('/users/me/favorites').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(findCard(res.body).creator);
    });
});

// The client reconciles its card state by REPLACING the card with the one a
// mutation returns. A mutation response without `creator` would blank the byline
// the moment you like or comment — so every mutation path must carry it too.
describe('creator embed — mutation responses', () => {
    it('PATCH /cards/:id (like) returns the card with its author', async () => {
        const res = await request(app).patch(`/cards/${cardId}`).set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(res.body.creator);
    });

    it('PATCH /cards/:id/comments (add comment) returns the card with its author', async () => {
        const res = await request(app)
            .patch(`/cards/${cardId}/comments`).set('auth-token', tokenB)
            .send({ commentText: 'Another comment' });
        expect(res.status).toBe(200);
        expectCreator(res.body.creator);
    });

    it('PATCH .../comments/:commentId/replies (add reply) returns the card with its author', async () => {
        const res = await request(app)
            .patch(`/cards/${cardId}/comments/${commentId}/replies`).set('auth-token', tokenB)
            .send({ replyText: 'A reply' });
        expect(res.status).toBe(200);
        expectCreator(res.body.creator);
    });

    it('PATCH .../comments/:commentId/like returns the card with its author', async () => {
        const res = await request(app)
            .patch(`/cards/${cardId}/comments/${commentId}/like`).set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(res.body.creator);
    });

    it('PATCH .../comments/:commentId (remove comment) returns the card with its author', async () => {
        const added = await request(app)
            .patch(`/cards/${cardId}/comments`).set('auth-token', tokenB)
            .send({ commentText: 'Doomed comment' });
        const doomedId = added.body.comments.find(c => c.commentText === 'Doomed comment')._id;

        const res = await request(app)
            .patch(`/cards/${cardId}/comments/${doomedId}`).set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expectCreator(res.body.creator);
    });
});

describe('creator embed — batch enrichment', () => {
    it('embeds the author on EVERY card in a multi-card list', async () => {
        // Seed several more cards by the same author, then read the list back:
        // every card must carry the embedded author (one batched User.find).
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post('/cards').set('auth-token', tokenA)
                .field('title', `Bulk ${i}`).field('content', 'bulk').field('category', 'general')
                .attach('media', Buffer.from('x'), { filename: 'b.png', contentType: 'image/png' });
        }

        const res = await request(app).get('/cards').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        const mine = res.body.filter(c => String(c.userId) === String(userAId));
        expect(mine.length).toBeGreaterThanOrEqual(4);
        for (const c of mine) expectCreator(c.creator);
    });
});
