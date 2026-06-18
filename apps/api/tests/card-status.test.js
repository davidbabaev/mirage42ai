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

let mongoServer;
let app;
let Card;
let User;

const normalUser = {
    name: 'Norm', lastName: 'User', email: 'norm.status@example.com',
    password: 'Password1!', phone: '0501112222', age: 30, birthDate: '1995-06-15', address: {},
};
const adminUser = {
    name: 'Addy', lastName: 'Min', email: 'admin.status@example.com',
    password: 'Password1!', phone: '0503334444', age: 35, birthDate: '1990-01-01', address: {},
};

let normalToken;
let adminToken;
let adminId;
let bannedCardId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    Card = requireFromHere('../src/cards/models/Card');
    User = requireFromHere('../src/users/models/User');

    const reg = await request(app).post('/users').send(normalUser);
    normalToken = reg.body.token;

    const regAdmin = await request(app).post('/users').send(adminUser);
    adminToken = regAdmin.body.token;
    adminId = regAdmin.body.safeUser._id;
    // Promotion can only come from the DB (role is read from the DB, never the token).
    await User.findByIdAndUpdate(adminId, { isAdmin: true });

    // A card owned by the admin that we will ban through the real endpoint.
    const card = await Card.create({
        title: 'Bannable',
        content: 'will be banned',
        userId: adminId,
    });
    bannedCardId = card._id.toString();
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('Card.status replaces isBanned (server-side ban enforcement)', () => {
    it('admin ban sets status to "banned" (not a boolean flag)', async () => {
        const res = await request(app)
            .patch(`/cards/${bannedCardId}/ban`)
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('banned');
    });

    it('GET /cards/:id of a banned card returns 404 to a non-admin', async () => {
        const asNonAdmin = await request(app)
            .get(`/cards/${bannedCardId}`)
            .set('auth-token', normalToken);
        expect(asNonAdmin.status).toBe(404);

        const asAnon = await request(app).get(`/cards/${bannedCardId}`);
        expect(asAnon.status).toBe(404);
    });

    it('GET /cards/:id of a banned card stays visible to an admin, with status', async () => {
        const res = await request(app)
            .get(`/cards/${bannedCardId}`)
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('banned');
    });

    it('GET /cards excludes banned cards for the public but includes them for admins', async () => {
        const anon = await request(app).get('/cards');
        expect(anon.body.find(c => c._id === bannedCardId)).toBeFalsy();

        const admin = await request(app).get('/cards').set('auth-token', adminToken);
        expect(admin.body.find(c => c._id === bannedCardId)).toBeTruthy();
    });

    it('un-banning restores public visibility', async () => {
        const res = await request(app)
            .patch(`/cards/${bannedCardId}/ban`)
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('active');

        const asAnon = await request(app).get(`/cards/${bannedCardId}`);
        expect(asAnon.status).toBe(200);
    });
});
