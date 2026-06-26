// Safe placeholder env vars before any app code loads (matches other suites).
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let app;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());
    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

// The 3-step register form no longer collects phone or last name. The shared
// user-creation validation must accept a registration that omits both.
describe('registration: phone and lastName are optional', () => {
    it('creates a user with no phone and no lastName', async () => {
        const res = await request(app).post('/users').send({
            name: 'Auto',
            email: 'reg-optional-nofields@example.com',
            password: 'Password1!',
            age: 30,
            birthDate: '1995-06-15',
            gender: 'Male',
            address: { country: 'Israel', city: 'Alma' },
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('safeUser');
    });

    // Guard against weakening the shared password rule: a 6-char, low-complexity
    // password must still be rejected by the API.
    it('still rejects a weak password', async () => {
        const res = await request(app).post('/users').send({
            name: 'Auto',
            email: 'reg-optional-weakpw@example.com',
            password: 'weak12',
            age: 30,
            birthDate: '1995-06-15',
            gender: 'Male',
            address: { country: 'Israel', city: 'Alma' },
        });
        expect(res.status).toBe(400);
    });
});
