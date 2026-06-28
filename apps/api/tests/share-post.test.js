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
let chatSvc;

const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.share@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let tokenA, userAId, userBId, cardId;

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
    chatSvc = requireFromHere(path.join(__dirname, '../src/chat/service/chatSvc'));

    // A (Alice Anderson) owns a card; B (Bob Baker) is a share recipient.
    const regA = await request(app).post('/users').send(mkUser('share-a', { name: 'Alice', lastName: 'Anderson' }));
    tokenA = regA.body.token; userAId = regA.body.safeUser._id;
    const regB = await request(app).post('/users').send(mkUser('share-b', { name: 'Bob', lastName: 'Baker' }));
    userBId = regB.body.safeUser._id;

    const card = await request(app)
        .post('/cards').set('auth-token', tokenA)
        .field('title', 'My great post').field('content', 'body text').field('category', 'general')
        .attach('media', Buffer.from('fake-image-bytes'), { filename: 't.png', contentType: 'image/png' });
    cardId = card.body._id;
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('user search (GET /users?q=)', () => {
    // Names are stored lowercase (validator lowercase:true); search is
    // case-insensitive so a title-case query still matches.
    it('returns only users whose name/lastName prefix-matches the query', async () => {
        const res = await request(app).get('/users?q=Ali').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        const names = res.body.map((u) => u.name);
        expect(names).toContain('alice');
        expect(names).not.toContain('bob');
    });

    it('matches on lastName too', async () => {
        const res = await request(app).get('/users?q=Baker').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.map((u) => u.name)).toContain('bob');
    });

    it('without q returns the full list (unchanged behavior)', async () => {
        const res = await request(app).get('/users').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
});

describe('sharing a post into chat builds a server-side preview snapshot', () => {
    it('createNewMessage from a cardId stores a rich sharedCard snapshot', async () => {
        const conv = await chatSvc.getOrCreateConversation(userAId, userBId);
        const msg = await chatSvc.createNewMessage(
            { conversationId: conv._id, sharedCardId: cardId },
            userAId,
        );
        expect(msg.sharedCard).toBeTruthy();
        expect(String(msg.sharedCard.cardId)).toBe(String(cardId));
        expect(msg.sharedCard.title).toBe('My great post');
        expect(msg.sharedCard.mediaUrl).toBe(FAKE_MEDIA_URL);
        expect(msg.sharedCard.authorName).toBe('alice anderson');
        // text is left empty — the card IS the content
        expect(msg.text).toBeFalsy();
    });

    it('rejects sharing a non-existent card', async () => {
        const conv = await chatSvc.getOrCreateConversation(userAId, userBId);
        const ghost = new mongoose.Types.ObjectId();
        await expect(
            chatSvc.createNewMessage({ conversationId: conv._id, sharedCardId: ghost }, userAId),
        ).rejects.toMatchObject({ status: 404 });
    });
});

describe('shared video card poster derivation', () => {
    it('derives a Cloudinary so_0 .jpg poster from a Cloudinary video url', () => {
        const v = 'https://res.cloudinary.com/demo/video/upload/v123/clip.mp4';
        expect(chatSvc.cloudinaryVideoPoster(v))
            .toBe('https://res.cloudinary.com/demo/video/upload/so_0/v123/clip.jpg');
    });

    it('returns null for a non-Cloudinary video url (e.g. external/seed)', () => {
        expect(chatSvc.cloudinaryVideoPoster('https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4')).toBeNull();
        expect(chatSvc.cloudinaryVideoPoster('')).toBeNull();
    });

    it('snapshot for a Cloudinary video card includes posterUrl; image card has none', async () => {
        const Card = requireFromHere(path.join(__dirname, '../src/cards/models/Card'));
        const vid = await Card.create({
            title: 'clip', content: 'c', userId: userAId, status: 'active',
            mediaType: 'video', mediaUrl: 'https://res.cloudinary.com/demo/video/upload/v9/abc.mp4',
        });
        const conv = await chatSvc.getOrCreateConversation(userAId, userBId);
        const vMsg = await chatSvc.createNewMessage({ conversationId: conv._id, sharedCardId: vid._id }, userAId);
        expect(vMsg.sharedCard.mediaType).toBe('video');
        expect(vMsg.sharedCard.posterUrl).toBe('https://res.cloudinary.com/demo/video/upload/so_0/v9/abc.jpg');

        // the earlier image card carries no posterUrl
        const iMsg = await chatSvc.createNewMessage({ conversationId: conv._id, sharedCardId: cardId }, userAId);
        expect(iMsg.sharedCard.posterUrl == null).toBe(true);
    });
});
