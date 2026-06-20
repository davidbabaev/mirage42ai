// HSTS on a plain-HTTP localhost response is a dev footgun: once a browser
// records Strict-Transport-Security for host `localhost`, it force-upgrades every
// http://localhost:* request (any port) to https. The API only speaks HTTP in
// dev, so the upgraded request fails the TLS handshake -> ERR_CONNECTION_RESET.
// Therefore: outside production the API must NOT emit an HSTS header.
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

describe('security headers in dev/test', () => {
    it('does not send Strict-Transport-Security outside production', async () => {
        const res = await request(app).get('/__any-route__');
        expect(res.headers['strict-transport-security']).toBeUndefined();
    });
});
