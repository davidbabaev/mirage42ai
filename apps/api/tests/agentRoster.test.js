// GET /agents/admin — how the runtime discovers which accounts it drives.
//
// The whole point of this endpoint is that the worker NEVER touches MongoDB
// (master-plan §3). That makes two properties load-bearing: it must return
// enough for the runtime to act, and it must be unreachable by anyone who is
// not an admin — the persona text it carries (backstory, voice) is the
// illusion's backstage.
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
const AGENT_PASSWORD = 'AgentSeed1!';
const quiet = { log: () => {} };

const mkUser = (slug) => ({
    name: 'Roster', lastName: 'Tester',
    email: `${slug}.roster@example.com`,
    password: 'Password1!', phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
});

let mongoServer, app, User;
let adminToken, humanToken, agentUserId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    User = requireFromHere('../src/users/models/User');
    const { seedAgentPersona } = requireFromHere('../src/seed/seedAgentPersona');

    const seeded = await seedAgentPersona({ password: AGENT_PASSWORD, logger: quiet });
    agentUserId = String(seeded.user._id);

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

describe('GET /agents/admin — authorization', () => {
    it('403s an ordinary logged-in user', async () => {
        const res = await request(app).get('/agents/admin').set('auth-token', humanToken);
        expect(res.status).toBe(403);
    });

    it('401s an anonymous caller', async () => {
        const res = await request(app).get('/agents/admin');
        expect(res.status).toBe(401);
    });

    it('does not leak persona text in the forbidden response', async () => {
        const res = await request(app).get('/agents/admin').set('auth-token', humanToken);
        expect(JSON.stringify(res.body ?? '') + String(res.text ?? ''))
            .not.toMatch(/backstory|Ben-Ari|branding studio/i);
    });
});

describe('GET /agents/admin — the roster an admin gets', () => {
    it('returns the seeded agent with its persona attached', async () => {
        const res = await request(app).get('/agents/admin').set('auth-token', adminToken);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.agents)).toBe(true);
        expect(res.body.agents).toHaveLength(1);

        const entry = res.body.agents[0];
        expect(String(entry.user._id)).toBe(agentUserId);
        expect(entry.user.name).toBeTruthy();
        expect(entry.persona).toBeTruthy();
    });

    it('carries everything the runtime needs to compile a prompt', async () => {
        const res = await request(app).get('/agents/admin').set('auth-token', adminToken);
        const { persona } = res.body.agents[0];

        for (const field of ['name', 'age', 'timezone', 'voice', 'backstory', 'values']) {
            expect(persona[field], `persona.${field} missing`).toBeTruthy();
        }
        expect(persona.relationship.status).toBe('married');
        expect(persona.relationship.openToRomance).toBe(false);
        expect(persona.activeHours.start).toBeGreaterThanOrEqual(0);
        expect(persona.dailyBudget.llmCalls).toBeGreaterThan(0);
        expect(persona.enabled).toBe(true);
    });

    it('never returns credentials or auth material', async () => {
        const res = await request(app).get('/agents/admin').set('auth-token', adminToken);
        const blob = JSON.stringify(res.body);

        for (const secret of ['password', 'refreshTokens', 'tokenHash', 'email']) {
            expect(blob).not.toContain(secret);
        }
    });

    it('excludes human accounts entirely', async () => {
        const res = await request(app).get('/agents/admin').set('auth-token', adminToken);
        const ids = res.body.agents.map(a => String(a.user._id));
        expect(ids).toEqual([agentUserId]);
    });

    it('reports an agent account with no persona rather than dropping it', async () => {
        // A seeding mistake should be visible to the operator, not silently
        // shrink the roster.
        const orphan = await new User({
            name: 'Orphan', lastName: 'Agent',
            email: 'orphan.agent@example.com',
            password: 'Password1!', kind: 'agent',
        }).save();

        const res = await request(app).get('/agents/admin').set('auth-token', adminToken);
        const entry = res.body.agents.find(a => String(a.user._id) === String(orphan._id));

        expect(entry).toBeTruthy();
        expect(entry.persona).toBeNull();

        await User.deleteOne({ _id: orphan._id });
    });
});
