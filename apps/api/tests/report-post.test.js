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

const mk = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.report@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let mongoServer, app;
let Card, User, Notification;

// Users
let tokenReporter, idReporter;
let tokenAuthor;
let tokenAdmin, idAdmin;
let tokenOther;

// Card
let cardId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Stub cloudinary before app loads.
    const cloudinaryPath = requireFromHere.resolve(
        path.join(__dirname, '../src/utils/cloudinary')
    );
    requireFromHere.cache[cloudinaryPath] = {
        id: cloudinaryPath, filename: cloudinaryPath, loaded: true,
        exports: fakeCloudinary, children: [], paths: [],
    };

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    Card         = requireFromHere('../src/cards/models/Card');
    User         = requireFromHere('../src/users/models/User');
    Notification = requireFromHere('../src/notifications/models/Notification');

    // Register users
    const rAuthor   = await request(app).post('/users').send(mk('rp-author'));
    tokenAuthor = rAuthor.body.token;

    const rReporter = await request(app).post('/users').send(mk('rp-reporter'));
    tokenReporter = rReporter.body.token; idReporter = rReporter.body.safeUser._id;

    const rAdmin    = await request(app).post('/users').send(mk('rp-admin'));
    tokenAdmin = rAdmin.body.token; idAdmin = rAdmin.body.safeUser._id;
    await User.findByIdAndUpdate(idAdmin, { isAdmin: true });

    const rOther    = await request(app).post('/users').send(mk('rp-other'));
    tokenOther = rOther.body.token;

    // Create a card via the API (cloudinary is stubbed)
    const cardRes = await request(app)
        .post('/cards')
        .set('auth-token', tokenAuthor)
        .field('title', 'A reportable post')
        .field('content', 'some content')
        .field('category', 'general')
        .attach('media', Buffer.from('img'), { filename: 'p.png', contentType: 'image/png' });
    cardId = cardRes.body._id;
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const report = (token, id, reason) =>
    request(app).post(`/cards/${id}/report`).set('auth-token', token).send({ reason });

describe('POST /cards/:id/report', () => {
    it('requires authentication', async () => {
        const res = await request(app).post(`/cards/${cardId}/report`).send({ reason: 'spam' });
        expect(res.status).toBe(401);
    });

    it('rejects an invalid reason with 400', async () => {
        const res = await report(tokenReporter, cardId, 'not-a-valid-reason');
        expect(res.status).toBe(400);
    });

    it('returns 403 when the author tries to report their own post', async () => {
        const res = await report(tokenAuthor, cardId, 'spam');
        expect(res.status).toBe(403);
    });

    it('reporter can report a post once (success, alreadyReported: false)', async () => {
        const res = await report(tokenReporter, cardId, 'spam');
        expect(res.status).toBe(200);
        expect(res.body.alreadyReported).toBe(false);
    });

    it('reportCount is incremented to 1 after first report', async () => {
        const card = await Card.findById(cardId).lean();
        expect(card.reportCount).toBe(1);
    });

    it('creates a post-reported admin notification on a new report', async () => {
        const notifs = await Notification.find({
            actionType: 'post-reported',
            whichCard: new mongoose.Types.ObjectId(cardId),
            toUser: new mongoose.Types.ObjectId(idAdmin),
        }).lean();
        expect(notifs.length).toBeGreaterThanOrEqual(1);
        // fromUser is set to the reporter so admins can trace the report
        expect(String(notifs[0].fromUser)).toBe(idReporter);
    });

    it('second report by the same user is deduped (200, alreadyReported: true)', async () => {
        const res = await report(tokenReporter, cardId, 'spam');
        expect(res.status).toBe(200);
        expect(res.body.alreadyReported).toBe(true);
    });

    it('reportCount does NOT double on a duplicate report', async () => {
        const card = await Card.findById(cardId).lean();
        expect(card.reportCount).toBe(1);
    });

    it('a different user can also report the same post (separate entry)', async () => {
        const res = await report(tokenOther, cardId, 'harassment');
        expect(res.status).toBe(200);
        expect(res.body.alreadyReported).toBe(false);
        const card = await Card.findById(cardId).lean();
        expect(card.reportCount).toBe(2);
    });

    it('returns 404 when reporting a banned card', async () => {
        // Ban the card via admin endpoint, then try to report it.
        await request(app).patch(`/cards/${cardId}/ban`).set('auth-token', tokenAdmin);
        const res = await report(tokenReporter, cardId, 'spam');
        expect(res.status).toBe(404);
        // Restore for subsequent tests
        await request(app).patch(`/cards/${cardId}/ban`).set('auth-token', tokenAdmin);
    });

    it('returns 404 when reporting a card whose author has blocked the reporter', async () => {
        // Author blocks reporter (either-direction → reporter cannot see author's card)
        await request(app)
            .patch(`/users/${idReporter}/block`)
            .set('auth-token', tokenAuthor);

        const res = await report(tokenReporter, cardId, 'spam');
        expect(res.status).toBe(404);

        // Unblock so later tests are not affected
        await request(app)
            .patch(`/users/${idReporter}/block`)
            .set('auth-token', tokenAuthor);
    });
});

describe('GET /cards/:id/reports', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).get(`/cards/${cardId}/reports`);
        expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin authenticated user', async () => {
        const res = await request(app)
            .get(`/cards/${cardId}/reports`)
            .set('auth-token', tokenOther);
        expect(res.status).toBe(403);
    });

    it('returns reporter identities + reasons + timestamps for an admin', async () => {
        const res = await request(app)
            .get(`/cards/${cardId}/reports`)
            .set('auth-token', tokenAdmin);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        // At least the two reports from reporter + other are present
        expect(res.body.length).toBeGreaterThanOrEqual(2);

        const first = res.body[0];
        expect(first).toHaveProperty('reason');
        expect(first).toHaveProperty('createdAt');
        expect(first.reporter).toHaveProperty('_id');
        expect(first.reporter).toHaveProperty('name');
        expect(first.reporter).toHaveProperty('lastName');
        expect(first.reporter).toHaveProperty('profilePicture');
    });
});
