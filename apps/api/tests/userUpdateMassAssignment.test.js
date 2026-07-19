// PUT /users/:id used to spread `...req.body` straight into findByIdAndUpdate.
// The route's auth guard checks WHO you are (self or admin) but never WHICH
// fields you may touch — so any logged-in user could hand themselves `isAdmin`,
// clear their own ban, or store a plaintext password, simply by adding the key
// to the profile-edit body.
//
// Each test below sends a hostile body and asserts the DATABASE is unchanged.
// Asserting on the response alone would prove nothing: the projections hide
// most of these fields, so a successful escalation would look identical.
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

const mkUser = (slug, over = {}) => ({
    name: 'Mass', lastName: 'Assign',
    email: `${slug}.ma@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15', address: {},
    ...over,
});

let mongoServer, app, User;
let token, id, originalPasswordHash;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    User = requireFromHere('../src/users/models/User');

    const r = await request(app).post('/users').send(mkUser('ma-victim'));
    token = r.body.token; id = r.body.safeUser._id;
    originalPasswordHash = (await User.findById(id).lean()).password;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

// The profile-edit route is behind multer (it accepts avatar/cover uploads), so
// the real client always sends MULTIPART. A plain JSON body leaves `req.files`
// undefined and the handler 500s before it ever reaches updateUser — which would
// make every assertion below pass for the wrong reason. Send fields the way the
// form does.
const putAsSelf = (fields) => {
    const req = request(app).put(`/users/${id}`).set('auth-token', token);
    for (const [k, v] of Object.entries(fields)) req.field(k, String(v));
    return req;
};

describe('PUT /users/:id — mass assignment is blocked', () => {
    it('cannot grant itself isAdmin (privilege escalation)', async () => {
        await putAsSelf({ name: 'Mass', isAdmin: true });
        const doc = await User.findById(id).lean();
        expect(doc.isAdmin).toBe(false);
    });

    it('cannot clear its own ban', async () => {
        await User.updateOne({ _id: id }, { $set: { isBanned: true } });
        await putAsSelf({ name: 'Mass', isBanned: false });
        const doc = await User.findById(id).lean();
        expect(doc.isBanned).toBe(true);
        await User.updateOne({ _id: id }, { $set: { isBanned: false } });
    });

    it('cannot set kind — an account cannot declare itself an agent', async () => {
        await putAsSelf({ name: 'Mass', kind: 'agent' });
        const doc = await User.findById(id).lean();
        expect(doc.kind).toBe('human');
    });

    it('cannot write a plaintext password through the profile form', async () => {
        await putAsSelf({ name: 'Mass', password: 'NotHashed123!' });
        const doc = await User.findById(id).lean();
        expect(doc.password).toBe(originalPasswordHash);
        expect(doc.password).not.toBe('NotHashed123!');
    });

    it('cannot overwrite googleId (account-takeover vector)', async () => {
        await putAsSelf({ name: 'Mass', googleId: 'attacker-google-id' });
        const doc = await User.findById(id).lean();
        expect(doc.googleId).not.toBe('attacker-google-id');
    });

    it('still applies the legitimate profile fields it is meant to', async () => {
        const res = await putAsSelf({
            name: 'Renamed', lastName: 'Person', job: 'Chef',
            aboutMe: 'hello', isAdmin: true,
        });
        expect(res.status).toBeLessThan(400);

        const doc = await User.findById(id).lean();
        expect(doc.name).toBe('renamed');   // schema lowercases name/lastName
        expect(doc.job).toBe('Chef');
        expect(doc.aboutMe).toBe('hello');
        expect(doc.isAdmin).toBe(false);    // ...and still not an admin
    });
});
