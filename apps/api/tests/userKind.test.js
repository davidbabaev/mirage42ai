// Phase F / F1 — `User.kind` ('human' | 'agent', master-plan §5).
//
// Two things must hold and keep holding:
//   1. A user is a HUMAN unless something deliberately says otherwise.
//   2. `kind` never reaches another user. Whether agents are disclosed is a
//      launch decision to be made with legal input (master-plan §11); until
//      then the field must not leak through ANY public read path, and a client
//      must not be able to award itself `kind: 'agent'` by putting it in a body.
//
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
const { ACCOUNT_KIND } = requireFromHere('@mirage42ai/shared');

const mkUser = (slug, over = {}) => ({
    name: 'Kind', lastName: 'Tester',
    email: `${slug}.kind@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let mongoServer, app, User;
let tokenA, idA;          // the subject being looked at
let tokenB, idB;          // another ordinary user (the "public" viewer)
let adminToken;           // an admin viewer

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    User = requireFromHere('../src/users/models/User');

    const rA = await request(app).post('/users').send(mkUser('kind-a'));
    tokenA = rA.body.token; idA = rA.body.safeUser._id;

    const rB = await request(app).post('/users').send(mkUser('kind-b'));
    tokenB = rB.body.token; idB = rB.body.safeUser._id;

    const rAdmin = await request(app).post('/users').send(mkUser('kind-admin'));
    adminToken = rAdmin.body.token;
    await User.updateOne({ _id: rAdmin.body.safeUser._id }, { $set: { isAdmin: true } });
    // Re-login so the token carries the admin claim.
    const relogin = await request(app).post('/users/login')
        .send({ email: mkUser('kind-admin').email, password: 'Password1!' });
    adminToken = relogin.body.token;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('User.kind — default', () => {
    it("defaults to 'human' on a newly registered user", async () => {
        const doc = await User.findById(idA).lean();
        expect(doc.kind).toBe(ACCOUNT_KIND.HUMAN);
    });

    it("rejects a kind outside the enum at the schema level", async () => {
        const bad = new User({ ...mkUser('kind-bad'), kind: 'robot' });
        await expect(bad.validate()).rejects.toThrow(/kind/);
    });

    it("accepts 'agent' when set server-side", async () => {
        await User.updateOne({ _id: idA }, { $set: { kind: ACCOUNT_KIND.AGENT } });
        const doc = await User.findById(idA).lean();
        expect(doc.kind).toBe(ACCOUNT_KIND.AGENT);
        // restore for the redaction tests below
        await User.updateOne({ _id: idA }, { $set: { kind: ACCOUNT_KIND.HUMAN } });
    });
});

describe('User.kind — redaction from public responses', () => {
    // Mark A as an agent: if `kind` leaks anywhere, these assertions catch the
    // real value rather than an indistinguishable default.
    beforeAll(async () => {
        await User.updateOne({ _id: idA }, { $set: { kind: ACCOUNT_KIND.AGENT } });
    });

    it('GET /users/:id — another user does NOT receive kind', async () => {
        const res = await request(app).get(`/users/${idA}`).set('auth-token', tokenB);
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('kind');
    });

    // NOTE: a list endpoint runs every row through projectUser, and the VIEWER'S
    // OWN row legitimately takes the self branch — so the viewer sees `kind` on
    // themselves inside a list, exactly as they do on their own profile. The
    // property that matters is that no OTHER user's row carries it.
    it('GET /users/browse — no OTHER user carries kind', async () => {
        const res = await request(app).get('/users/browse').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        const items = res.body.items ?? res.body.users ?? res.body;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);

        const others = items.filter(u => String(u._id) !== String(idB));
        expect(others.length).toBeGreaterThan(0);
        for (const u of others) expect(u).not.toHaveProperty('kind');

        // and the agent specifically is indistinguishable from a human here
        const subject = items.find(u => String(u._id) === String(idA));
        if (subject) expect(subject).not.toHaveProperty('kind');
    });

    it('GET /users/search — no OTHER user carries kind', async () => {
        const res = await request(app).get('/users/search?term=Kind').set('auth-token', tokenB);
        expect(res.status).toBe(200);
        const items = res.body.items ?? res.body.users ?? res.body;
        const others = items.filter(u => String(u._id) !== String(idB));
        expect(others.length).toBeGreaterThan(0);
        for (const u of others) expect(u).not.toHaveProperty('kind');
    });

    it('the owner DOES see their own kind (self projection)', async () => {
        const res = await request(app).get(`/users/${idA}`).set('auth-token', tokenA);
        expect(res.status).toBe(200);
        expect(res.body.kind).toBe(ACCOUNT_KIND.AGENT);
    });

    it('an admin DOES see kind (moderation needs to tell agents apart)', async () => {
        const res = await request(app).get(`/users/${idA}`).set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.kind).toBe(ACCOUNT_KIND.AGENT);
    });
});

describe('User.kind — a client cannot assign it at registration', () => {
    it('rejects a registration body carrying kind', async () => {
        const res = await request(app).post('/users')
            .send(mkUser('kind-selfclaim', { kind: ACCOUNT_KIND.AGENT }));

        // The register schema is `.unknown(false)`, so an unexpected key is a
        // 400 rather than a silently-ignored one. Either way the requirement is
        // the same: it must not reach the database.
        expect(res.status).toBeGreaterThanOrEqual(400);
        const created = await User.findOne({ email: mkUser('kind-selfclaim').email }).lean();
        expect(created).toBeNull();
    });

    // The PUT /users/:id path is covered in userUpdateMassAssignment.test.js —
    // that route had a wholesale `...req.body` spread, which is a broader hole
    // than `kind` alone and is fixed as its own concern.
});
