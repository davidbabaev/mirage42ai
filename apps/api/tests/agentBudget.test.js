// Phase F / F5 follow-up — the DURABLE budget ledger (§6/§11).
//
// This is the server side of "the daily cap survives a restart": the worker
// hydrates from GET /agents/admin/budget and writes each spend through to
// POST /agents/admin/budget/:agentUserId. The properties that matter:
//   1. an increment is atomic and CUMULATIVE (never a clobber),
//   2. a read returns exactly one day's spend, per agent,
//   3. a client-supplied `kind` cannot reach the $inc path unvalidated,
//   4. both routes are admin-only (the worker has no other privileged path).
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

let mongoServer, app, User, AgentBudget, svc;
let adminToken, humanToken;

const DAY = '2026-07-19';
const OTHER_DAY = '2026-07-20';

const mkUser = (slug) => ({
    name: 'Budget', lastName: 'Tester',
    email: `${slug}.budget@example.com`,
    password: 'Password1!', phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
});

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    User = requireFromHere('../src/users/models/User');
    AgentBudget = requireFromHere('../src/agents/models/AgentBudget');
    svc = requireFromHere('../src/agents/service/agentBudgetSvc');
    await AgentBudget.init(); // build the unique index, so the unique test is meaningful

    const human = await request(app).post('/users').send(mkUser('human'));
    humanToken = human.body.token;

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
    await AgentBudget.deleteMany({});
});

const agentId = () => String(new mongoose.Types.ObjectId());

describe('agentBudgetSvc.incrementBudget — atomic, cumulative, validated', () => {
    it('creates the row on the first spend and adds to it after', async () => {
        const a1 = agentId();
        const first = await svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'images' });
        expect(first.spend.images).toBe(1);

        const second = await svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'images' });
        expect(second.spend.images).toBe(2);

        // Exactly one document — the second call updated, it did not insert.
        expect(await AgentBudget.countDocuments({ agentUserId: a1, day: DAY })).toBe(1);
    });

    it('keeps the three kinds independent within a day', async () => {
        const a1 = agentId();
        await svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'llmCalls', amount: 5 });
        await svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'images' });

        const row = await AgentBudget.findOne({ agentUserId: a1, day: DAY }).lean();
        expect(row.spend).toMatchObject({ llmCalls: 5, images: 1, actions: 0 });
    });

    it('honours a positive multi-unit amount', async () => {
        const a1 = agentId();
        const r = await svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'actions', amount: 3 });
        expect(r.spend.actions).toBe(3);
    });

    it('rejects an unknown kind rather than writing an arbitrary field', async () => {
        const a1 = agentId();
        await expect(svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'money' }))
            .rejects.toMatchObject({ status: 400 });
        // And nothing was written under a junk key.
        expect(await AgentBudget.countDocuments({ agentUserId: a1 })).toBe(0);
    });

    it('rejects a malformed day, a missing agent, and a non-positive amount', async () => {
        const a1 = agentId();
        await expect(svc.incrementBudget({ agentUserId: a1, day: '19-07-2026', kind: 'images' }))
            .rejects.toMatchObject({ status: 400 });
        await expect(svc.incrementBudget({ agentUserId: '', day: DAY, kind: 'images' }))
            .rejects.toMatchObject({ status: 400 });
        await expect(svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'images', amount: 0 }))
            .rejects.toMatchObject({ status: 400 });
        await expect(svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'images', amount: -2 }))
            .rejects.toMatchObject({ status: 400 });
    });

    it('two concurrent write-throughs both land — one does not clobber the other', async () => {
        const a1 = agentId();
        const results = await Promise.allSettled([
            svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'llmCalls' }),
            svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'llmCalls' }),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

        const row = await AgentBudget.findOne({ agentUserId: a1, day: DAY }).lean();
        expect(row.spend.llmCalls).toBe(2);
    });
});

describe('agentBudgetSvc.getBudgetForDay — one day, every agent', () => {
    it('returns each agent\'s spend for the requested day only', async () => {
        const a1 = agentId();
        const a2 = agentId();
        await svc.incrementBudget({ agentUserId: a1, day: DAY, kind: 'images' });
        await svc.incrementBudget({ agentUserId: a2, day: DAY, kind: 'actions', amount: 4 });
        // A different day must not leak into today's hydrate.
        await svc.incrementBudget({ agentUserId: a1, day: OTHER_DAY, kind: 'images' });

        const budgets = await svc.getBudgetForDay(DAY);
        const byAgent = Object.fromEntries(budgets.map((b) => [b.agentUserId, b.spend]));

        expect(budgets).toHaveLength(2);
        expect(byAgent[a1]).toMatchObject({ images: 1, actions: 0 });
        expect(byAgent[a2]).toMatchObject({ actions: 4, images: 0 });
    });

    it('returns an empty list for a day with no spend', async () => {
        expect(await svc.getBudgetForDay(DAY)).toEqual([]);
    });

    it('rejects a missing or malformed day', async () => {
        await expect(svc.getBudgetForDay(undefined)).rejects.toMatchObject({ status: 400 });
        await expect(svc.getBudgetForDay('nonsense')).rejects.toMatchObject({ status: 400 });
    });
});

describe('the routes — admin-only, and a real hydrate/write-through round-trip', () => {
    it('403s a non-admin and 401s an anonymous caller on both routes', async () => {
        const a1 = agentId();
        expect((await request(app).get('/agents/admin/budget?day=' + DAY).set('auth-token', humanToken)).status).toBe(403);
        expect((await request(app).get('/agents/admin/budget?day=' + DAY)).status).toBe(401);

        const post = (tok) => {
            const r = request(app).post(`/agents/admin/budget/${a1}`);
            return (tok ? r.set('auth-token', tok) : r).send({ kind: 'images', day: DAY });
        };
        expect((await post(humanToken)).status).toBe(403);
        expect((await post(null)).status).toBe(401);
    });

    it('a POST spend is reflected in the very next GET — the restart contract', async () => {
        const a1 = agentId();

        const inc = await request(app).post(`/agents/admin/budget/${a1}`)
            .set('auth-token', adminToken)
            .send({ kind: 'images', day: DAY });
        expect(inc.status).toBe(200);
        expect(inc.body.spend.images).toBe(1);

        const read = await request(app).get('/agents/admin/budget?day=' + DAY)
            .set('auth-token', adminToken);
        expect(read.status).toBe(200);
        expect(read.body.day).toBe(DAY);
        const mine = read.body.budgets.find((b) => b.agentUserId === a1);
        expect(mine.spend.images).toBe(1);
    });

    it('400s a write with an unknown kind', async () => {
        const res = await request(app).post(`/agents/admin/budget/${agentId()}`)
            .set('auth-token', adminToken)
            .send({ kind: 'bribes', day: DAY });
        expect(res.status).toBe(400);
    });

    it('400s a read with no day', async () => {
        const res = await request(app).get('/agents/admin/budget').set('auth-token', adminToken);
        expect(res.status).toBe(400);
    });
});
