// POST /cards used to reject any request without a file ("File not found"),
// so every post in the app had to carry an image. Real people write text-only
// posts constantly, and master-plan §6 calls for agents to mix text-only posts
// with image ones — so this was a gap for humans and a blocker for F3.
//
// The distinction that matters and is easy to get wrong: "no mediaUrl supplied"
// (legacy callers — still get the placeholder) vs "mediaUrl is explicitly
// empty" (a deliberate text-only post — must stay empty).
//
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

const FAKE_MEDIA_URL = 'https://fake.test/uploaded.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const requireFromHere = createRequire(import.meta.url);

let mongoServer, app, Card, normalizeCard;
let token, userId;

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
    Card = requireFromHere('../src/cards/models/Card');
    normalizeCard = requireFromHere('../src/cards/helpers/normalizeCard');

    const r = await request(app).post('/users').send({
        name: 'Text', lastName: 'Poster',
        email: 'text.poster@example.com',
        password: 'Password1!', phone: '0501234567',
        age: 30, birthDate: '1995-06-15', address: {},
    });
    token = r.body.token; userId = r.body.safeUser._id;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('normalizeCard — text-only vs missing media', () => {
    it('still applies the placeholder when mediaUrl is not supplied at all', () => {
        const out = normalizeCard({ content: 'hello' });
        expect(out.mediaUrl).toBe(normalizeCard.PLACEHOLDER_MEDIA_URL);
        expect(out.mediaType).toBe('image');
    });

    it('keeps an EXPLICIT empty mediaUrl empty, with no mediaType', () => {
        const out = normalizeCard({ content: 'hello', mediaUrl: '' });
        expect(out.mediaUrl).toBe('');
        // '' would fail the schema enum ['image','video'] — must be undefined.
        expect(out.mediaType).toBeUndefined();
    });
});

describe('POST /cards — text-only', () => {
    it('creates a post with no media at all', async () => {
        const res = await request(app).post('/cards')
            .set('auth-token', token)
            .field('content', 'just some words, no picture');

        expect(res.status).toBeLessThan(400);
        expect(res.body.content).toBe('just some words, no picture');
        expect(res.body.mediaUrl).toBe('');
        expect(res.body.mediaType).toBeUndefined();

        // ...and it really persisted that way, enum validation included.
        const doc = await Card.findById(res.body._id).lean();
        expect(doc.mediaUrl).toBe('');
        expect(doc.mediaType).toBeUndefined();
        expect(doc.status).toBe('active');
    });

    it('still requires content — a post cannot be empty', async () => {
        const res = await request(app).post('/cards')
            .set('auth-token', token)
            .field('title', 'no body');
        expect(res.status).toBe(400);
    });

    it('still uploads and records media when a file IS attached', async () => {
        const res = await request(app).post('/cards')
            .set('auth-token', token)
            .field('content', 'a post with a picture')
            .attach('media', Buffer.from('img'), { filename: 'p.png', contentType: 'image/png' });

        expect(res.status).toBeLessThan(400);
        expect(res.body.mediaUrl).toBe(FAKE_MEDIA_URL);
        expect(res.body.mediaType).toBe('image');
    });

    it('a text-only post appears in ANOTHER user\'s feed like any other', async () => {
        // The cold-start feed deliberately excludes your own posts, so this has
        // to be checked from a second account — checking the author's own feed
        // would assert nothing.
        const viewer = await request(app).post('/users').send({
            name: 'Feed', lastName: 'Viewer',
            email: 'feed.viewer@example.com',
            password: 'Password1!', phone: '0501234567',
            age: 30, birthDate: '1995-06-15', address: {},
        });

        const res = await request(app).get('/cards/feed').set('auth-token', viewer.body.token);
        expect(res.status).toBe(200);

        const textOnly = res.body.cards.find(c => c.mediaUrl === '');
        expect(textOnly).toBeTruthy();
        expect(textOnly.content).toBe('just some words, no picture');
        expect(String(textOnly.userId)).toBe(String(userId));
        // The creator embed still resolves — a media-less post is not a
        // second-class citizen in the feed.
        expect(textOnly.creator?.name).toBeTruthy();
    });
});
