// Safe placeholder env vars before any app code is loaded.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);

let mongoServer;
let app;
let Card;
let User;
let Notification;

let adminToken, adminId, authorId, cardId;

const mk = (slug, over = {}) => ({
    name: 'Test', lastName: 'User', email: `${slug}.removed@example.com`,
    password: 'Password1!', phone: '0501112222', age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    Card = requireFromHere('../src/cards/models/Card');
    User = requireFromHere('../src/users/models/User');
    Notification = requireFromHere('../src/notifications/models/Notifications');

    const author = await request(app).post('/users').send(mk('author'));
    authorId = author.body.safeUser._id;

    const admin = await request(app).post('/users').send(mk('admin'));
    adminToken = admin.body.token;
    adminId = admin.body.safeUser._id;
    await User.findByIdAndUpdate(adminId, { isAdmin: true });

    const card = await Card.create({ title: 'Bad post', content: 'spam', userId: authorId });
    cardId = card._id.toString();
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const ban = () => request(app).patch(`/cards/${cardId}/ban`).set('auth-token', adminToken);
const removedNotifs = () =>
    Notification.find({ actionType: 'post-removed', toUser: authorId, whichCard: cardId });

describe('notify author when their post is banned/removed', () => {
    it('banning a post creates a post-removed notification to the AUTHOR, without exposing the moderator', async () => {
        const res = await ban();
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('banned');

        const notifs = await removedNotifs();
        expect(notifs).toHaveLength(1);
        expect(String(notifs[0].toUser)).toBe(authorId);
        // moderator identity is not leaked
        expect(notifs[0].fromUser == null).toBe(true);
    });

    it('the author can read the notification from GET /notifications', async () => {
        // log the author in to fetch their own notifications
        const login = await request(app).post('/users/login')
            .send({ email: 'author.removed@example.com', password: 'Password1!' });
        const res = await request(app).get('/notifications').set('auth-token', login.body.token);
        expect(res.status).toBe(200);
        const mine = res.body.items.find(n => n.actionType === 'post-removed' && n.whichCard === cardId);
        expect(mine).toBeTruthy();
    });

    it('un-banning does NOT create another notification', async () => {
        const res = await ban(); // banned -> active
        expect(res.body.status).toBe('active');
        expect(await removedNotifs()).toHaveLength(1);
    });

    it('re-banning creates a second notification', async () => {
        const res = await ban(); // active -> banned again
        expect(res.body.status).toBe('banned');
        expect(await removedNotifs()).toHaveLength(2);
    });
});
