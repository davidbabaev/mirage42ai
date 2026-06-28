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

describe('recent contacts (GET /users/recent-contacts)', () => {
    let tokenR, idR, idS, idT, tokenS;
    beforeAll(async () => {
        const rR = await request(app).post('/users').send(mkUser('rc-r', { name: 'Rita' }));
        tokenR = rR.body.token; idR = rR.body.safeUser._id;
        const rS = await request(app).post('/users').send(mkUser('rc-s', { name: 'Sam' }));
        tokenS = rS.body.token; idS = rS.body.safeUser._id;
        const rT = await request(app).post('/users').send(mkUser('rc-t', { name: 'Tom' }));
        idT = rT.body.safeUser._id;

        // R messages S first, then T — so most-recent order is [Tom, Sam].
        const cRS = await chatSvc.getOrCreateConversation(idR, idS);
        await chatSvc.createNewMessage({ conversationId: cRS._id, text: 'hi sam' }, idR);
        const cRT = await chatSvc.getOrCreateConversation(idR, idT);
        await chatSvc.createNewMessage({ conversationId: cRT._id, text: 'hi tom' }, idR);
    }, 60_000);

    it('requires auth', async () => {
        expect((await request(app).get('/users/recent-contacts')).status).toBe(401);
    });

    it('returns the other participants, most-recent first, capped', async () => {
        const res = await request(app).get('/users/recent-contacts?limit=10').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.map((u) => u._id);
        expect(ids.slice(0, 2)).toEqual([idT, idS]); // Tom (newest) before Sam
        expect(res.body[0]).toHaveProperty('displayName');
        expect(res.body[0]).toHaveProperty('lastInteractedAt');
        expect(res.body.every((u) => u._id !== idR)).toBe(true); // never yourself
    });

    it('excludes blocked users (either direction)', async () => {
        await request(app).patch(`/users/${idT}/block`).set('auth-token', tokenR);
        const res = await request(app).get('/users/recent-contacts').set('auth-token', tokenR);
        expect(res.body.some((u) => u._id === idT)).toBe(false); // Tom blocked → gone
        expect(res.body.some((u) => u._id === idS)).toBe(true);  // Sam still there
        await request(app).patch(`/users/${idT}/block`).set('auth-token', tokenR); // restore
    });

    it('is owner-scoped: each user sees only their own contacts', async () => {
        const res = await request(app).get('/users/recent-contacts').set('auth-token', tokenS);
        // Sam only ever talked to Rita
        expect(res.body.map((u) => u._id)).toEqual([idR]);
    });
});

describe('external OG share route (GET /s/card/:cardId)', () => {
    let imgId, vidId;
    beforeAll(async () => {
        const Card = requireFromHere(path.join(__dirname, '../src/cards/models/Card'));
        imgId = (await Card.create({
            title: 'Coffee tour', content: 'visited five shops', userId: userAId, status: 'active',
            mediaType: 'image', mediaUrl: 'https://res.cloudinary.com/demo/image/upload/v1/pic.jpg',
        }))._id;
        vidId = (await Card.create({
            title: 'Clip', content: 'a clip', userId: userAId, status: 'active',
            mediaType: 'video', mediaUrl: 'https://res.cloudinary.com/demo/video/upload/v2/mov.mp4',
        }))._id;
    });

    it('image post: post-specific OG + Twitter tags, 1200x630 Cloudinary image, redirect', async () => {
        const res = await request(app).get(`/s/card/${imgId}`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
        const h = res.text;
        expect(h).toContain('property="og:title" content="alice anderson');
        expect(h).toContain('property="og:image" content="https://res.cloudinary.com/demo/image/upload/c_fill,w_1200,h_630/v1/pic.jpg"');
        expect(h).toContain('name="twitter:card" content="summary_large_image"');
        expect(h).toContain('property="og:site_name" content="Mirage42"');
        // both human-redirect mechanisms to the SPA deep link
        expect(h).toContain(`url=http://localhost:5173/allcards?card=${imgId}`);
        expect(h).toContain(`location.replace("http://localhost:5173/allcards?card=${imgId}")`);
    });

    it('video post: og:image is the Cloudinary so_0 poster frame', async () => {
        const res = await request(app).get(`/s/card/${vidId}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('property="og:image" content="https://res.cloudinary.com/demo/video/upload/so_0/v2/mov.jpg"');
    });

    it('missing/gone card: neutral "not available" card, 404', async () => {
        const ghost = new mongoose.Types.ObjectId();
        const res = await request(app).get(`/s/card/${ghost}`);
        expect(res.status).toBe(404);
        // apostrophe is HTML-escaped in the rendered attribute
        expect(res.text).toContain('This post isn&#39;t available.');
    });
});
