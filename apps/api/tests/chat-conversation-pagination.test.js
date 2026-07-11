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
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const N = 25; // conversations for the hub user
const mkUser = (tag) => ({
    name: tag, lastName: 'Test', email: `convpag-${tag}@example.com`,
    password: 'Password1!', phone: '0501234567', age: 30,
    birthDate: '1995-06-15', address: {},
});

let mongoServer, app;
let chatSvc;
let hubId, hubToken;
const others = []; // others[n] = { id, token }, conversation ordered oldest->newest

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    chatSvc = requireFromHere(path.join(__dirname, '../src/chat/service/chatSvc'));

    const regHub = await request(app).post('/users').send(mkUser('hub'));
    if (regHub.status !== 200) throw new Error(`Hub register failed: ${regHub.status}`);
    hubId = regHub.body.safeUser._id;
    hubToken = regHub.body.token;

    // N others, each opening a conversation with the hub and sending ONE message
    // TO the hub — so the hub has exactly one unread per conversation (total N),
    // and updatedAt increases with n (a tiny sleep guarantees strict ordering),
    // making others[N-1] the newest conversation.
    for (let n = 0; n < N; n++) {
        const reg = await request(app).post('/users').send(mkUser(`u${n}`));
        if (reg.status !== 200) throw new Error(`u${n} register failed: ${reg.status}`);
        const id = reg.body.safeUser._id;
        others.push({ id, token: reg.body.token });
        const conv = await chatSvc.getOrCreateConversation(id, hubId);
        await chatSvc.createNewMessage({ conversationId: conv._id, text: `hi from u${n}` }, id);
        await sleep(2);
    }
}, 120_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const other = (c) => (String(c.fromUser) === String(hubId) ? String(c.toUser) : String(c.fromUser));
const listPage = (cursor) => {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=10` : `?limit=10`;
    return request(app).get(`/chats${q}`).set('auth-token', hubToken).then(r => r.body);
};

describe('conversation-list pagination (keyset by updatedAt, newest first)', () => {
    it('first page returns the NEWEST conversations with a nextCursor', async () => {
        const p = await listPage();
        expect(Array.isArray(p.conversations)).toBe(true);
        expect(p.conversations).toHaveLength(10);
        // newest first: others[24] down to others[15]
        const expected = others.slice(N - 10).reverse().map(o => o.id);
        expect(p.conversations.map(other)).toEqual(expected);
        expect(p.nextCursor).toBeTruthy();
    });

    it('embeds the other participant per row (no global users scan needed)', async () => {
        const p = await listPage();
        for (const c of p.conversations) {
            expect(c.otherUser).toBeTruthy();
            expect(String(c.otherUser._id)).toBe(other(c));
            expect(c.otherUser).toHaveProperty('name');
            expect(c.otherUser).toHaveProperty('profilePicture');
        }
    });

    it('totalUnread on the first page counts ALL conversations, not just the page', async () => {
        const p = await listPage();
        // 10 rows on the page, but the badge total spans all N unread threads.
        expect(p.conversations).toHaveLength(10);
        expect(p.totalUnread).toBe(N);
        expect(p.conversations.every(c => c.unreadCount === 1)).toBe(true);
    });

    it('cursor pages omit totalUnread (client seeds once, keeps it live via sockets)', async () => {
        const p1 = await listPage();
        const p2 = await listPage(p1.nextCursor);
        expect(p2.totalUnread).toBeUndefined();
    });

    it('the cursor walks strictly OLDER with no overlap until exhausted', async () => {
        const p1 = await listPage();                 // 24..15
        const p2 = await listPage(p1.nextCursor);     // 14..5
        expect(p2.conversations).toHaveLength(10);
        const p3 = await listPage(p2.nextCursor);     // 4..0
        expect(p3.conversations).toHaveLength(5);
        expect(p3.nextCursor).toBeNull();

        // Reassemble newest->oldest across all pages: exactly others[24..0], no dupes.
        const seen = [...p1.conversations, ...p2.conversations, ...p3.conversations].map(other);
        expect(new Set(seen).size).toBe(N);
        expect(seen).toEqual([...others].reverse().map(o => o.id));
    });

    it('rejects a malformed cursor with 400 (no silent first-page fallback)', async () => {
        const res = await request(app).get('/chats?cursor=not-a-real-cursor').set('auth-token', hubToken);
        expect(res.status).toBe(400);
    });
});
