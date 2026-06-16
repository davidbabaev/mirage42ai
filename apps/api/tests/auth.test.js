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

let mongoServer;
let app;

const existingUser = {
    name: 'Alice',
    lastName: 'Aaron',
    email: 'auth-alice@example.com',
    password: 'Password1!',
    phone: '0501234567',
    age: 30,
    birthDate: '1995-06-15',
    address: {},
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    // Register a real user so the wrong-password path has something to fail against.
    const reg = await request(app).post('/users').send(existingUser);
    if (reg.status !== 200) {
        throw new Error(`Failed to register baseline test user: ${reg.status} ${reg.text}`);
    }
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('POST /users/login — invalid credentials', () => {
    it('returns 401 (not 500) for the right email with a wrong password', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: existingUser.email, password: 'WrongPassword-1!' });
        expect(res.status).toBe(401);
    });

    it('returns 401 (not 500) for an email that does not exist', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: 'nobody-no-account@example.com', password: 'Password1!' });
        expect(res.status).toBe(401);
    });
});

describe('POST /users/login — input validation (NoSQL-injection guard)', () => {
    it('still logs a real user in with valid string credentials (200 + token)', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: existingUser.email, password: existingUser.password });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
    });

    it('rejects a Mongo-operator injection payload with 400 (never reaches the DB query)', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: { $gt: '' }, password: { $gt: '' } });
        expect(res.status).toBe(400);
    });

    it('rejects an operator object in email even with a valid password (400)', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: { $gt: '' }, password: existingUser.password });
        expect(res.status).toBe(400);
    });

    it('rejects a non-string (numeric) password with 400', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: existingUser.email, password: 12345678 });
        expect(res.status).toBe(400);
    });

    it('rejects a missing password with 400', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({ email: existingUser.email });
        expect(res.status).toBe(400);
    });
});
