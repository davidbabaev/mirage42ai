// Safe placeholder env vars before any app code is loaded.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let app;

const user = {
    name: 'Role',
    lastName: 'Tester',
    email: 'role-tester@example.com',
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

    const reg = await request(app).post('/users').send(user);
    if (reg.status !== 200) {
        throw new Error(`Failed to register baseline test user: ${reg.status} ${reg.text}`);
    }
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const login = () =>
    request(app).post('/users/login').send({ email: user.email, password: user.password });

describe('role is read from the DB, not the token', () => {
    it('denies an admin-only action when the token claims isAdmin:true but the DB says false', async () => {
        const loginRes = await login();
        const me = jwt.decode(loginRes.body.token);

        // Forge a token that lies about admin status. The DB user is a normal user.
        const forged = jwt.sign(
            { userId: me.userId, isAdmin: true },
            process.env.JWT_SECRET,
        );

        // Promote route is admin-only; a forged isAdmin claim must not grant access.
        const res = await request(app)
            .patch(`/users/${me.userId}/promote`)
            .set('auth-token', forged)
            .send();
        expect(res.status).toBe(403);
    });
});
