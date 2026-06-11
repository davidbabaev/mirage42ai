// Set safe placeholder env vars BEFORE any app code is loaded so module-load
// side effects (e.g. passport-google-oauth20 requires a non-empty clientID)
// don't crash. Existing values are preserved if already set.
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
    // Override DB_CONNECTION_STRING defensively so any accidental connect attempt
    // hits the in-memory server, never the developer's real database.
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Import app AFTER env vars are set and mongoose is connected. The require.main
    // guard in src/app.js means importing it does NOT call server.listen().
    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('backend smoke', () => {
    it('responds 404 to an unknown route', async () => {
        const res = await request(app).get('/__definitely-not-a-real-route__');
        expect(res.status).toBe(404);
    });
});
