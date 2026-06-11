// IMPORTANT: do NOT default GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET here.
// The whole point of this test is to verify the app boots with them empty.
// Other env vars get safe defaults so unrelated module-load paths don't fail.
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let app;
let bootError = null;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Simulate the "Google OAuth not configured" scenario. Setting to '' rather
    // than `delete` so dotenv.config() in src/app.js doesn't restore values
    // from the on-disk .env file (dotenv won't overwrite existing keys, even
    // when their value is the empty string).
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';

    try {
        const mod = await import('../src/app.js');
        app = mod.app ?? mod.default?.app;
    } catch (err) {
        bootError = err;
    }
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('boot without Google OAuth credentials', () => {
    it('does not crash at module load when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are empty', () => {
        // Pre-fix: src/auth/googleStrategy.js runs `new GoogleStrategy({clientID:''})`
        // at module load, which throws synchronously, so `await import('../src/app.js')`
        // rejects and bootError is the TypeError from passport-oauth2.
        expect(bootError).toBeNull();
        expect(app).toBeDefined();
    });

    it('responds to GET /auth/google with 503 "not configured" instead of crashing', async () => {
        expect(app).toBeDefined();
        const res = await request(app).get('/auth/google');
        expect(res.status).toBe(503);
        expect(res.text).toMatch(/not configured/i);
    });
});
