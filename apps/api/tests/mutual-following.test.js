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

// GET /users/:id/mutual — people BOTH the requester and the target follow.
// The profile page used to derive this by filtering the global users array against
// two `following` lists; the intersection is now computed server-side.

let mongoServer;
let app;

const mkUser = (slug, over = {}) => ({
    name: 'User', lastName: slug,
    email: `${slug}.mutual@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

// me and them both follow BOTH_A and BOTH_B; only I follow MINE; only they follow THEIRS.
let tokenMe, tokenThem, idMe, idThem, idBothA, idBothB, idMine, idTheirs;

const register = async (slug) => {
    const res = await request(app).post('/users').send(mkUser(slug));
    return { token: res.body.token, id: res.body.safeUser._id };
};
const follow = (token, targetId) =>
    request(app).patch(`/users/${targetId}/follow`).set('auth-token', token);

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    const me = await register('mu-me');       tokenMe = me.token;   idMe = me.id;
    const them = await register('mu-them');   tokenThem = them.token; idThem = them.id;
    const bothA = await register('mu-botha'); idBothA = bothA.id;
    const bothB = await register('mu-bothb'); idBothB = bothB.id;
    const mine = await register('mu-mine');   idMine = mine.id;
    const theirs = await register('mu-theirs'); idTheirs = theirs.id;

    // I follow: bothA, bothB, mine
    await follow(tokenMe, idBothA);
    await follow(tokenMe, idBothB);
    await follow(tokenMe, idMine);

    // They follow: bothA, bothB, theirs
    await follow(tokenThem, idBothA);
    await follow(tokenThem, idBothB);
    await follow(tokenThem, idTheirs);
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const idsOf = (body) => (body.items || []).map(u => String(u._id)).sort();

describe('GET /users/:id/mutual', () => {
    it('returns only the people we BOTH follow', async () => {
        const res = await request(app)
            .get(`/users/${idThem}/mutual`).set('auth-token', tokenMe);

        expect(res.status).toBe(200);
        expect(idsOf(res.body)).toEqual([idBothA, idBothB].map(String).sort());
    });

    it('excludes people only I follow and people only they follow', async () => {
        const res = await request(app)
            .get(`/users/${idThem}/mutual`).set('auth-token', tokenMe);

        const ids = idsOf(res.body);
        expect(ids).not.toContain(String(idMine));
        expect(ids).not.toContain(String(idTheirs));
    });

    it('is symmetric — they see the same mutuals with me', async () => {
        const res = await request(app)
            .get(`/users/${idMe}/mutual`).set('auth-token', tokenThem);

        expect(res.status).toBe(200);
        expect(idsOf(res.body)).toEqual([idBothA, idBothB].map(String).sort());
    });

    it('returns an empty list (not an error) when there is no overlap', async () => {
        const stranger = await register('mu-stranger');
        const res = await request(app)
            .get(`/users/${stranger.id}/mutual`).set('auth-token', tokenMe);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
        expect(res.body.nextCursor).toBeNull();
    });

    it('404s for a non-existent user', async () => {
        const ghost = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .get(`/users/${ghost}/mutual`).set('auth-token', tokenMe);

        expect(res.status).toBe(404);
    });

    it('requires auth', async () => {
        const res = await request(app).get(`/users/${idThem}/mutual`);
        expect(res.status).toBe(401);
    });

    it('paginates', async () => {
        const res = await request(app)
            .get(`/users/${idThem}/mutual?limit=1`).set('auth-token', tokenMe);

        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.nextCursor).toBeTruthy();

        const page2 = await request(app)
            .get(`/users/${idThem}/mutual?limit=1&cursor=${encodeURIComponent(res.body.nextCursor)}`)
            .set('auth-token', tokenMe);

        expect(page2.status).toBe(200);
        expect(page2.body.items).toHaveLength(1);
        // No overlap between pages.
        expect(String(page2.body.items[0]._id)).not.toBe(String(res.body.items[0]._id));
    });
});
