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
    name: tag, lastName: 'Test', email: `chatdel-${tag}@example.com`,
    password: 'Password1!', phone: '0501234567', age: 30,
    birthDate: '1995-06-15', address: {},
});

let mongoServer, app;
let tokenA, tokenB, userAId, userBId;
let chatSvc, Conversation, Message;

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
    tokenB = regB.body.token; userBId = regB.body.safeUser._id;
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
    await Conversation.deleteMany({});
    await Message.deleteMany({});
});

// a conversation A<->B with one message from each side (the "old history")
async function seedConversation() {
    const conv = await chatSvc.getOrCreateConversation(userAId, userBId);
    await chatSvc.createNewMessage({ conversationId: conv._id, text: 'old #1 from A' }, userAId);
    await chatSvc.createNewMessage({ conversationId: conv._id, text: 'old #2 from B' }, userBId);
    return conv;
}

const listIds = (token) =>
    request(app).get('/chats').set('auth-token', token).then(r => r.body.conversations.map(c => c._id));
const chatRow = (token, convId) =>
    request(app).get('/chats').set('auth-token', token).then(r => r.body.conversations.find(c => c._id === String(convId)));
const messages = (token, convId) =>
    request(app).get(`/messages/${convId}`).set('auth-token', token).then(r => r.body.messages);

describe('per-side chat delete (deletedAt timestamp — WhatsApp behavior)', () => {
    it('clears MY history on delete; the other user keeps the full history', async () => {
        const conv = await seedConversation();
        await sleep(10);

        const del = await request(app).delete(`/chats/${conv._id}`).set('auth-token', tokenA);
        expect(del.status).toBe(200);

        // Alice: history gone, conversation hidden from her list
        expect(await messages(tokenA, conv._id)).toHaveLength(0);
        expect(await listIds(tokenA)).not.toContain(String(conv._id));

        // Bob: full history, conversation still listed
        expect(await messages(tokenB, conv._id)).toHaveLength(2);
        expect(await listIds(tokenB)).toContain(String(conv._id));

        // messages physically intact in the DB
        expect(await Message.countDocuments({ conversationId: conv._id })).toBe(2);
    });

    it('reappears for the deleter on a new message, showing ONLY post-delete messages', async () => {
        const conv = await seedConversation();
        await sleep(10);
        await request(app).delete(`/chats/${conv._id}`).set('auth-token', tokenA);
        await sleep(10);

        // Bob messages the conversation Alice deleted
        await chatSvc.createNewMessage({ conversationId: conv._id, text: 'NEW after delete' }, userBId);

        // Alice: conversation is back, but only the post-delete message is visible
        expect(await listIds(tokenA)).toContain(String(conv._id));
        const aliceMsgs = await messages(tokenA, conv._id);
        expect(aliceMsgs).toHaveLength(1);
        expect(aliceMsgs[0].text).toBe('NEW after delete');

        // her unread count reflects only the post-delete message
        expect((await chatRow(tokenA, conv._id)).unreadCount).toBe(1);

        // Bob still has the complete thread (old history + new)
        expect(await messages(tokenB, conv._id)).toHaveLength(3);
    });

    it('hard-deletes once BOTH have deleted with no newer messages', async () => {
        const conv = await seedConversation();
        await sleep(10);
        await request(app).delete(`/chats/${conv._id}`).set('auth-token', tokenA);
        const second = await request(app).delete(`/chats/${conv._id}`).set('auth-token', tokenB);
        expect(second.status).toBe(200);

        expect(await Conversation.findById(conv._id)).toBeNull();
        expect(await Message.countDocuments({ conversationId: conv._id })).toBe(0);
    });

    it('does NOT hard-delete when a message is newer than the earlier cutoff', async () => {
        const conv = await seedConversation();
        await sleep(10);
        await request(app).delete(`/chats/${conv._id}`).set('auth-token', tokenA); // Alice cutoff T1
        await sleep(10);
        await chatSvc.createNewMessage({ conversationId: conv._id, text: 'between' }, userBId); // > T1
        await sleep(10);
        await request(app).delete(`/chats/${conv._id}`).set('auth-token', tokenB); // Bob cutoff T3

        // a message newer than Alice's cutoff still exists -> she can resurface it -> keep
        expect(await Conversation.findById(conv._id)).not.toBeNull();
    });

    it('rejects deletion by a non-participant (403) and a missing conversation (404)', async () => {
        const conv = await seedConversation();
        const regC = await request(app).post('/users').send(mkUser('carol'));
        const tokenC = regC.body.token;

        const forbidden = await request(app).delete(`/chats/${conv._id}`).set('auth-token', tokenC);
        expect(forbidden.status).toBe(403);

        const missing = await request(app)
            .delete(`/chats/${new mongoose.Types.ObjectId()}`).set('auth-token', tokenA);
        expect(missing.status).toBe(404);
    });
});
