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

const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.np@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

// Collect every item from the cursor-paginated /notifications endpoint.
const collectAll = async (app, token, limit) => {
    const items = [];
    let cursor;
    for (let guard = 0; guard < 200; guard++) {
        const url = `/notifications?limit=${limit}` +
            (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
        const res = await request(app).get(url).set('auth-token', token);
        expect(res.status).toBe(200);
        items.push(...res.body.items);
        if (!res.body.nextCursor) break;
        cursor = res.body.nextCursor;
    }
    return items;
};

let mongoServer, app, Notification;
let tokenA, idA, tokenB, idB;

const TOTAL = 55;   // > the old hard 50-cap
const UNREAD = 12;  // how many are left unread

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    Notification = requireFromHere('../src/notifications/models/Notifications');

    const rA = await request(app).post('/users').send(mkUser('np-a'));
    tokenA = rA.body.token; idA = rA.body.safeUser._id;
    const rB = await request(app).post('/users').send(mkUser('np-b'));
    tokenB = rB.body.token; idB = rB.body.safeUser._id;

    // Seed 55 notifications addressed to A (from B), with strictly increasing
    // createdAt so the newest-first keyset order is deterministic. The last
    // UNREAD are left unread.
    const base = Date.now();
    const docs = [];
    for (let i = 0; i < TOTAL; i++) {
        docs.push({
            actionType: 'follow',
            fromUser: idB,
            toUser: idA,
            createdAt: new Date(base + i * 1000),
            isRead: i >= TOTAL - UNREAD ? false : true,
        });
    }
    await Notification.insertMany(docs);
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('GET /notifications — cursor pagination', () => {
    it('requires authentication', async () => {
        const res = await request(app).get('/notifications');
        expect(res.status).toBe(401);
    });

    it('returns { items, nextCursor, unreadCount } on the first page', async () => {
        const res = await request(app).get('/notifications').set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
        expect(typeof res.body.unreadCount).toBe('number');
    });

    it('honors limit and returns a nextCursor when more remain', async () => {
        const res = await request(app)
            .get('/notifications?limit=20')
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(20);
        expect(typeof res.body.nextCursor).toBe('string');
    });

    it('is newest-first (most recent createdAt leads)', async () => {
        const res = await request(app)
            .get('/notifications?limit=20')
            .set('auth-token', tokenA);
        const times = res.body.items.map(n => new Date(n.createdAt).getTime());
        const sortedDesc = [...times].sort((a, b) => b - a);
        expect(times).toEqual(sortedDesc);
    });

    it('paginates past the old 50-item cap — all 55 reachable, no duplicates', async () => {
        const items = await collectAll(app, tokenA, 20);
        expect(items.length).toBe(TOTAL);            // > 50: the old cap is gone
        const ids = items.map(n => String(n._id));
        expect(new Set(ids).size).toBe(TOTAL);       // no duplicates across pages
    });

    it('unreadCount reflects ALL unread rows, not just the first page', async () => {
        const res = await request(app)
            .get('/notifications?limit=20')
            .set('auth-token', tokenA);
        // 12 unread exist but sit beyond the first page of 20 (they are the
        // oldest here); the count must still be correct.
        expect(res.body.unreadCount).toBe(UNREAD);
    });

    it('omits unreadCount on deeper (cursor) pages', async () => {
        const first = await request(app)
            .get('/notifications?limit=20')
            .set('auth-token', tokenA);
        const res = await request(app)
            .get(`/notifications?limit=20&cursor=${encodeURIComponent(first.body.nextCursor)}`)
            .set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.unreadCount).toBeUndefined();
    });

    it('malformed cursor → 400', async () => {
        const res = await request(app)
            .get('/notifications?cursor=not-a-real-cursor')
            .set('auth-token', tokenA);
        expect(res.status).toBe(400);
    });

    it('a user with no notifications gets an empty page', async () => {
        const res = await request(app).get('/notifications').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(0);
        expect(res.body.nextCursor).toBeNull();
        expect(res.body.unreadCount).toBe(0);
    });
});
