process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

const mkUser = (tag) => ({
    name: tag, lastName: 'Test', email: `chatpag-${tag}@example.com`,
    password: 'Password1!', phone: '0501234567', age: 30,
    birthDate: '1995-06-15', address: {},
});

let mongoServer, app;
let tokenA, userAId, userBId;
let chatSvc, Conversation, Message;
let convId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    chatSvc = requireFromHere(path.join(__dirname, '../src/chat/service/chatSvc'));
    Conversation = requireFromHere(path.join(__dirname, '../src/chat/models/Conversation'));
    Message = requireFromHere(path.join(__dirname, '../src/chat/models/Message'));

    const regA = await request(app).post('/users').send(mkUser('alice'));
    const regB = await request(app).post('/users').send(mkUser('bob'));
    if (regA.status !== 200 || regB.status !== 200) {
        throw new Error(`Register failed: ${regA.status}/${regB.status}`);
    }
    tokenA = regA.body.token; userAId = regA.body.safeUser._id;
    userBId = regB.body.safeUser._id;
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

// A conversation A<->B with 25 messages, deterministically ordered #0 (oldest)
// .. #24 (newest). createNewMessage stamps createdAt, so a tiny sleep guarantees
// strictly increasing timestamps (keyset ties would otherwise fall to _id).
beforeEach(async () => {
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    const conv = await chatSvc.getOrCreateConversation(userAId, userBId);
    convId = conv._id;
    for (let n = 0; n < 25; n++) {
        await chatSvc.createNewMessage({ conversationId: convId, text: `msg #${n}` }, userAId);
        await sleep(2);
    }
});

const page = (token, cursor) => {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=10` : `?limit=10`;
    return request(app).get(`/messages/${convId}${q}`).set('auth-token', token).then(r => r.body);
};

describe('chat message pagination (keyset, newest page first, load older)', () => {
    it('first page returns the NEWEST messages, ascending, with a nextCursor', async () => {
        const p = await page(tokenA);
        expect(Array.isArray(p.messages)).toBe(true);
        expect(p.messages).toHaveLength(10);
        // ascending within the page: oldest of this page first, newest last
        expect(p.messages[0].text).toBe('msg #15');
        expect(p.messages[9].text).toBe('msg #24');
        expect(p.nextCursor).toBeTruthy();
    });

    it('the cursor walks strictly OLDER, no overlap, until exhausted', async () => {
        const p1 = await page(tokenA);            // #15..#24
        const p2 = await page(tokenA, p1.nextCursor); // #5..#14
        expect(p2.messages).toHaveLength(10);
        expect(p2.messages[0].text).toBe('msg #5');
        expect(p2.messages[9].text).toBe('msg #14');
        expect(p2.nextCursor).toBeTruthy();

        const p3 = await page(tokenA, p2.nextCursor); // #0..#4 (last 5)
        expect(p3.messages).toHaveLength(5);
        expect(p3.messages[0].text).toBe('msg #0');
        expect(p3.messages[4].text).toBe('msg #4');
        expect(p3.nextCursor).toBeNull();

        // Reassembling all pages reproduces the full 0..24 sequence with no gaps.
        const all = [...p3.messages, ...p2.messages, ...p1.messages].map(m => m.text);
        expect(all).toEqual(Array.from({ length: 25 }, (_, i) => `msg #${i}`));
    });

    it('respects the client limit, clamped to a sane max', async () => {
        const p = await request(app).get(`/messages/${convId}?limit=3`).set('auth-token', tokenA).then(r => r.body);
        expect(p.messages).toHaveLength(3);
        expect(p.messages[2].text).toBe('msg #24');
    });

    it('rejects a malformed cursor with 400 (no silent latest-page fallback)', async () => {
        const res = await request(app).get(`/messages/${convId}?cursor=not-a-real-cursor`).set('auth-token', tokenA);
        expect(res.status).toBe(400);
    });
});
