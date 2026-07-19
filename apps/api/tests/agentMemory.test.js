// AgentMemory — "continuity = realism" (master-plan §5).
//
// The property that matters is NOT that memory stores things. It is that the
// right thing survives: an agent that forgets it already turned someone down
// will be freshly charmed by the same advance next week, which is exactly what
// makes an agent read as a machine.
//
// Safe placeholder env vars before any app code is loaded.
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

const requireFromHere = createRequire(import.meta.url);
const quiet = { log: () => {} };
const AGENT_PW = 'AgentSeed1!';

const mkUser = (slug) => ({
    name: 'Mem', lastName: 'Tester',
    email: `${slug}.mem@example.com`,
    password: 'Password1!', phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
});

let mongoServer, app, User, AgentMemory, svc;
let adminToken, humanToken, agentId, humanId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    User = requireFromHere('../src/users/models/User');
    AgentMemory = requireFromHere('../src/agents/models/AgentMemory');
    svc = requireFromHere('../src/agents/service/agentMemorySvc');
    await AgentMemory.init();

    const { seedAgentPersona } = requireFromHere('../src/seed/seedAgentPersona');
    const seeded = await seedAgentPersona({ password: AGENT_PW, logger: quiet });
    agentId = String(seeded.user._id);

    const human = await request(app).post('/users').send(mkUser('human'));
    humanToken = human.body.token; humanId = human.body.safeUser._id;

    const admin = await request(app).post('/users').send(mkUser('admin'));
    await User.updateOne({ _id: admin.body.safeUser._id }, { $set: { isAdmin: true } });
    const relogin = await request(app).post('/users/login')
        .send({ email: mkUser('admin').email, password: 'Password1!' });
    adminToken = relogin.body.token;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
    await AgentMemory.deleteMany({});
});

describe('agentMemorySvc — events are a bounded rolling log', () => {
    it('appends newest last and creates the document on first write', async () => {
        await svc.appendEvent(agentId, { type: 'post', summary: 'posted about the beach' });
        await svc.appendEvent(agentId, { type: 'like', summary: 'liked a bread photo' });

        const mem = await svc.loadMemory(agentId);
        expect(mem.events.map(e => e.summary)).toEqual([
            'posted about the beach', 'liked a bread photo',
        ]);
    });

    it('trims to the cap, dropping the OLDEST', async () => {
        for (let i = 0; i < svc.MAX_EVENTS + 10; i++) {
            await svc.appendEvent(agentId, { type: 'post', summary: `event ${i}` });
        }
        const mem = await svc.loadMemory(agentId);

        expect(mem.events).toHaveLength(svc.MAX_EVENTS);
        expect(mem.events[0].summary).toBe('event 10');           // oldest survivor
        expect(mem.events.at(-1).summary).toBe(`event ${svc.MAX_EVENTS + 9}`);
    });

    it('rejects an event with no summary — an unreadable memory is not a memory', async () => {
        await expect(svc.appendEvent(agentId, { type: 'post' })).rejects.toThrow(/summary/);
    });

    it('returns an empty memory rather than null for an agent that has none', async () => {
        const mem = await svc.loadMemory(new mongoose.Types.ObjectId());
        expect(mem.events).toEqual([]);
        expect(mem.facts).toEqual([]);
    });
});

describe('agentMemorySvc — facts are per-relationship and durable', () => {
    it('keeps multiple facts about the same person', async () => {
        await svc.appendFact(agentId, { userId: humanId, fact: 'David asked me out; I said I am married.' });
        await svc.appendFact(agentId, { userId: humanId, fact: 'David is a developer.' });

        const mem = await svc.loadMemory(agentId);
        expect(mem.facts).toHaveLength(2);
    });

    it('THE POINT: a fact survives a flood of unrelated events', async () => {
        // This is the regression that matters. Record the decline, then have a
        // very busy week, then check she still knows.
        await svc.appendFact(agentId, {
            userId: humanId, fact: 'David asked me out; I told him I am married and said no.',
        });
        for (let i = 0; i < svc.MAX_EVENTS * 2; i++) {
            await svc.appendEvent(agentId, { type: 'post', summary: `busy day ${i}` });
        }

        const mem = await svc.loadMemory(agentId);
        const forPrompt = svc.memoryForPrompt(mem, humanId);

        // Events rotated away...
        expect(mem.events).toHaveLength(svc.MAX_EVENTS);
        // ...but the fact is still there, and still reaches the prompt.
        expect(forPrompt.facts).toHaveLength(1);
        expect(forPrompt.facts[0].fact).toMatch(/married/);
    });

    it('rejects a fact with no subject', async () => {
        await expect(svc.appendFact(agentId, { fact: 'something' })).rejects.toThrow(/userId/);
    });
});

describe('memoryForPrompt — only what is worth spending tokens on', () => {
    it('caps recent events', async () => {
        for (let i = 0; i < 30; i++) {
            await svc.appendEvent(agentId, { type: 'post', summary: `e${i}` });
        }
        const forPrompt = svc.memoryForPrompt(await svc.loadMemory(agentId), null);
        expect(forPrompt.events).toHaveLength(svc.PROMPT_EVENTS);
        expect(forPrompt.events.at(-1).summary).toBe('e29'); // most recent kept
    });

    it('returns only facts about THIS person', async () => {
        const otherId = new mongoose.Types.ObjectId();
        await svc.appendFact(agentId, { userId: humanId, fact: 'about david' });
        await svc.appendFact(agentId, { userId: otherId, fact: 'about someone else' });

        const forPrompt = svc.memoryForPrompt(await svc.loadMemory(agentId), humanId);
        expect(forPrompt.facts.map(f => f.fact)).toEqual(['about david']);
    });

    it('sends no facts when there is no counterpart', async () => {
        await svc.appendFact(agentId, { userId: humanId, fact: 'about david' });
        expect(svc.memoryForPrompt(await svc.loadMemory(agentId), null).facts).toEqual([]);
    });
});

describe('the memory API the runtime uses', () => {
    it('403s a non-admin on read and write', async () => {
        expect((await request(app).get(`/agents/admin/${agentId}/memory`)
            .set('auth-token', humanToken)).status).toBe(403);
        expect((await request(app).post(`/agents/admin/${agentId}/memory`)
            .set('auth-token', humanToken)
            .send({ events: [{ type: 'post', summary: 'x' }] })).status).toBe(403);
    });

    it('round-trips events and facts for an admin', async () => {
        const write = await request(app).post(`/agents/admin/${agentId}/memory`)
            .set('auth-token', adminToken)
            .send({
                events: [{ type: 'dm_received', withUserId: humanId, summary: 'David asked me out' }],
                facts: [{ userId: humanId, fact: 'David asked me out; I said I am married.' }],
            });
        expect(write.status).toBe(200);
        expect(write.body.eventCount).toBe(1);
        expect(write.body.factCount).toBe(1);

        const read = await request(app).get(`/agents/admin/${agentId}/memory`)
            .set('auth-token', adminToken);
        expect(read.status).toBe(200);
        expect(read.body.events[0].summary).toBe('David asked me out');
        expect(read.body.facts[0].fact).toMatch(/married/);
    });

    it('refuses to attach memory to a HUMAN account', async () => {
        const res = await request(app).post(`/agents/admin/${humanId}/memory`)
            .set('auth-token', adminToken)
            .send({ events: [{ type: 'post', summary: 'x' }] });

        expect(res.status).toBe(400);
        expect(await AgentMemory.countDocuments({ userId: humanId })).toBe(0);
    });

    it('rejects an empty write and an oversized one', async () => {
        expect((await request(app).post(`/agents/admin/${agentId}/memory`)
            .set('auth-token', adminToken).send({})).status).toBe(400);

        const many = Array.from({ length: 25 }, (_, i) => ({ type: 'post', summary: `e${i}` }));
        expect((await request(app).post(`/agents/admin/${agentId}/memory`)
            .set('auth-token', adminToken).send({ events: many })).status).toBe(400);
    });

    it('404s for a user that does not exist', async () => {
        const res = await request(app)
            .get(`/agents/admin/${new mongoose.Types.ObjectId()}/memory`)
            .set('auth-token', adminToken);
        expect(res.status).toBe(404);
    });
});
