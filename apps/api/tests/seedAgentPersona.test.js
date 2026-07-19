// Phase F / F2 — the seeded agent account.
//
// The requirement that actually matters here is INDISTINGUISHABILITY
// (master-plan §3): the agent's user row must be an ordinary user in every
// respect, and `kind` must be the only difference — invisible to every other
// user. So this suite does not just check the seed ran; it logs in as a
// DIFFERENT user and asserts the agent looks exactly like a person.
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

let mongoServer, app, User, AgentPersona, seedAgentPersona, AGENT_USER;
let agentUserId;
let humanToken;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    User = requireFromHere('../src/users/models/User');
    AgentPersona = requireFromHere('../src/agents/models/AgentPersona');
    ({ seedAgentPersona, AGENT_USER } = requireFromHere('../src/seed/seedAgentPersona'));

    const { user } = await seedAgentPersona({ password: AGENT_PASSWORD, logger: quiet });
    agentUserId = String(user._id);

    // An ordinary human, to look at the agent the way any other user would.
    const human = await request(app).post('/users').send({
        name: 'Ordinary', lastName: 'Human',
        email: 'ordinary.human@example.com',
        password: 'Password1!', phone: '0501234567',
        age: 30, birthDate: '1995-06-15', address: {},
    });
    humanToken = human.body.token;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('seedAgentPersona — refuses a weak or missing credential', () => {
    it('throws without a password rather than inventing a default', async () => {
        await expect(seedAgentPersona({ logger: quiet })).rejects.toThrow(/AGENT_SEED_PASSWORD/);
    });

    it('throws on a password the registration form would reject', async () => {
        await expect(
            seedAgentPersona({ password: 'weakpass', logger: quiet })
        ).rejects.toThrow(/too weak/);
    });
});

describe('seedAgentPersona — what it creates', () => {
    it("marks the account kind:'agent'", async () => {
        const doc = await User.findById(agentUserId).lean();
        expect(doc.kind).toBe('agent');
    });

    it('creates exactly one linked persona, with budgets and active hours', async () => {
        const personas = await AgentPersona.find({ userId: agentUserId }).lean();
        expect(personas).toHaveLength(1);
        const p = personas[0];
        expect(p.name).toBeTruthy();
        expect(p.timezone).toBe('Asia/Jerusalem');
        expect(p.dailyBudget.llmCalls).toBeGreaterThan(0);
        expect(p.activeHours.start).toBeLessThan(p.activeHours.end);
        // The persona whose whole point is declining advances.
        expect(p.relationship.status).toBe('married');
        expect(p.relationship.openToRomance).toBe(false);
    });

    it('looks like an established account, not a fresh signup', async () => {
        const doc = await User.findById(agentUserId).lean();
        expect(doc.onboardingComplete).toBe(true);
        expect(doc.name).toBeTruthy();
        expect(doc.lastName).toBeTruthy();
        expect(doc.age).toBeGreaterThanOrEqual(18);
        expect(doc.address.city).toBeTruthy();
        expect(doc.job).toBeTruthy();
        expect(doc.profilePicture).toBeTruthy(); // normalizeUser's default, as any human gets
    });

    it('is idempotent — re-running creates no second user and no second persona', async () => {
        const before = await User.countDocuments({});
        const second = await seedAgentPersona({ password: AGENT_PASSWORD, logger: quiet });

        expect(second.created).toBe(false);
        expect(String(second.user._id)).toBe(agentUserId);
        expect(await User.countDocuments({})).toBe(before);
        expect(await AgentPersona.countDocuments({ userId: agentUserId })).toBe(1);
    });

    it('does not disturb other users (scoped, never deleteMany)', async () => {
        const human = await User.findOne({ email: 'ordinary.human@example.com' }).lean();
        expect(human).toBeTruthy();
        expect(human.kind).toBe('human');
    });
});

describe('the seeded agent is INDISTINGUISHABLE to another user', () => {
    it('GET /users/:id — no kind leaks to a human viewer', async () => {
        const res = await request(app)
            .get(`/users/${agentUserId}`)
            .set('auth-token', humanToken);

        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('kind');
        // ...and it still renders as a normal profile.
        expect(res.body.name).toBeTruthy();
        expect(res.body.job).toBeTruthy();
    });

    it('carries no agent-ish marker in any public field', async () => {
        const res = await request(app)
            .get(`/users/${agentUserId}`)
            .set('auth-token', humanToken);

        const blob = JSON.stringify(res.body).toLowerCase();
        // NOTE: these are regex SOURCE strings — '\\b' (escaped) is a word
        // boundary. Writing '\b' here would be a literal backspace character
        // and the check would pass without testing anything.
        const tells = ['agent', 'persona', '\\bbot\\b', '\\bai\\b', '\\bllm\\b', 'mirage42\\.ai'];

        // Self-check: prove each pattern really matches when the tell IS
        // present, so a broken pattern fails here instead of quietly passing
        // the assertion below forever.
        const positive = 'agent persona bot ai llm mirage42.ai';
        for (const tell of tells) expect(positive).toMatch(new RegExp(tell));

        for (const tell of tells) expect(blob).not.toMatch(new RegExp(tell));
    });

    it('appears in a user listing looking like everyone else', async () => {
        const res = await request(app).get('/users/browse').set('auth-token', humanToken);
        expect(res.status).toBe(200);
        const items = res.body.items ?? res.body.users ?? res.body;
        const agent = items.find(u => String(u._id) === agentUserId);
        expect(agent).toBeTruthy();
        expect(agent).not.toHaveProperty('kind');
    });

    it('the persona document is never reachable through any user-facing route', async () => {
        // There is deliberately no persona endpoint in F2. If one is ever added,
        // this is the test that should force the question of who may read it.
        const res = await request(app)
            .get(`/agent-personas/${agentUserId}`)
            .set('auth-token', humanToken);
        expect(res.status).toBe(404);
    });
});

describe('the seeded agent can authenticate like any human', () => {
    it('logs in through POST /users/login and receives a usable token', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: AGENT_USER.email, password: AGENT_PASSWORD });

        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(20);
        expect(String(res.body.safeUser._id)).toBe(agentUserId);

        // The token actually works on an authenticated route.
        const me = await request(app)
            .get(`/users/${agentUserId}`)
            .set('auth-token', res.body.token);
        expect(me.status).toBe(200);
        // Its OWN response carries kind — self projection. Only it and admins.
        expect(me.body.kind).toBe('agent');
    });

    it('rejects a wrong password, exactly as for a human account', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: AGENT_USER.email, password: 'WrongPassword1!' });
        expect(res.status).toBe(401);
    });
});
