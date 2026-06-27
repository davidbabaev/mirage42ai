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

const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.block@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let mongoServer, app;
let tokenA, tokenB, idA, idB;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());
    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    const regA = await request(app).post('/users').send(mkUser('blk-a'));
    tokenA = regA.body.token; idA = regA.body.safeUser._id;
    const regB = await request(app).post('/users').send(mkUser('blk-b'));
    tokenB = regB.body.token; idB = regB.body.safeUser._id;

    // A and B follow each other, so we can assert the block tears it down.
    await request(app).patch(`/users/${idB}/follow`).set('auth-token', tokenA);
    await request(app).patch(`/users/${idA}/follow`).set('auth-token', tokenB);
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const block = (token, target) => request(app).patch(`/users/${target}/block`).set('auth-token', token);

describe('block user', () => {
    it('requires auth and rejects self-block', async () => {
        expect((await request(app).patch(`/users/${idB}/block`)).status).toBe(401);
        const self = await block(tokenA, idA);
        expect(self.status).toBe(400);
    });

    it('A blocking B records the block and removes the mutual follow', async () => {
        const res = await block(tokenA, idB);
        expect(res.status).toBe(200);
        expect(res.body.blocked).toContain(idB);
        expect(res.body.following || []).not.toContain(idB); // A no longer follows B

        // B no longer follows A either (self GET shows own following)
        const bSelf = await request(app).get(`/users/${idB}`).set('auth-token', tokenB);
        expect(bSelf.body.following || []).not.toContain(idA);
    });

    it('hides each user from the other in GET /users (both directions)', async () => {
        const aList = await request(app).get('/users').set('auth-token', tokenA);
        expect(aList.body.some(u => u._id === idB)).toBe(false);
        const bList = await request(app).get('/users').set('auth-token', tokenB);
        expect(bList.body.some(u => u._id === idA)).toBe(false);
    });

    it("404s the blocked user's profile in both directions", async () => {
        expect((await request(app).get(`/users/${idB}`).set('auth-token', tokenA)).status).toBe(404);
        expect((await request(app).get(`/users/${idA}`).set('auth-token', tokenB)).status).toBe(404);
    });

    it('rejects following across a block (both directions)', async () => {
        expect((await request(app).patch(`/users/${idB}/follow`).set('auth-token', tokenA)).status).toBe(403);
        expect((await request(app).patch(`/users/${idA}/follow`).set('auth-token', tokenB)).status).toBe(403);
    });

    it('unblock restores visibility', async () => {
        const res = await block(tokenA, idB); // toggle off
        expect(res.status).toBe(200);
        expect(res.body.blocked || []).not.toContain(idB);
        expect((await request(app).get(`/users/${idB}`).set('auth-token', tokenA)).status).toBe(200);
    });

    it('does not leak the blocked list in another user\'s public profile', async () => {
        // re-block so A has a non-empty blocked list, then B views A
        await block(tokenA, idB);
        await block(tokenA, idB); // unblock again to keep other state clean
        // C (third party) views A's public profile -> no `blocked` field
        const regC = await request(app).post('/users').send(mkUser('blk-c'));
        const aPublic = await request(app).get(`/users/${idA}`).set('auth-token', regC.body.token);
        expect(aPublic.status).toBe(200);
        expect(aPublic.body.blocked).toBeUndefined();
    });
});
