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
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

const mkUser = (tag) => ({
    name: tag, lastName: 'Test', email: `fav-${tag}@example.com`,
    password: 'Password1!', phone: '0501234567', age: 30,
    birthDate: '1995-06-15', address: {},
});

let mongoServer, app, Card;
let tokenA, userAId, activeCardId, bannedCardId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    Card = requireFromHere(path.join(__dirname, '../src/cards/models/Card'));

    const regA = await request(app).post('/users').send(mkUser('alice'));
    if (regA.status !== 200) throw new Error(`Register failed: ${regA.status}`);
    tokenA = regA.body.token; userAId = regA.body.safeUser._id;

    const active = await Card.create({
        userId: userAId, title: 'Fav me', content: 'a favouritable post',
        category: 'general', status: 'active',
        mediaUrl: 'https://fake.test/img.png', mediaType: 'image',
    });
    activeCardId = String(active._id);
    const banned = await Card.create({
        userId: userAId, title: 'Banned', content: 'hidden',
        category: 'general', status: 'banned',
        mediaUrl: 'https://fake.test/img2.png', mediaType: 'image',
    });
    bannedCardId = String(banned._id);
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

const auth = (t) => ({ 'auth-token': t });

describe('favorites — server-persisted (cross-device)', () => {
    it('requires auth', async () => {
        expect((await request(app).get('/users/me/favorites')).status).toBe(401);
        expect((await request(app).post(`/users/me/favorites/${activeCardId}`)).status).toBe(401);
    });

    it('starts empty', async () => {
        const res = await request(app).get('/users/me/favorites').set(auth(tokenA));
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('adds a favorite (idempotent) and returns the id list', async () => {
        const r1 = await request(app).post(`/users/me/favorites/${activeCardId}`).set(auth(tokenA));
        expect(r1.status).toBe(200);
        expect(r1.body.favorites).toContain(activeCardId);
        // adding again does not duplicate ($addToSet)
        const r2 = await request(app).post(`/users/me/favorites/${activeCardId}`).set(auth(tokenA));
        expect(r2.body.favorites.filter(id => id === activeCardId)).toHaveLength(1);
    });

    it('GET returns hydrated, active card objects (not just ids)', async () => {
        const res = await request(app).get('/users/me/favorites').set(auth(tokenA));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]._id).toBe(activeCardId);
        expect(res.body[0].title).toBe('Fav me');       // full object, fresh from DB
        expect(res.body[0].content).toBe('a favouritable post');
    });

    it('removes a favorite', async () => {
        const del = await request(app).delete(`/users/me/favorites/${activeCardId}`).set(auth(tokenA));
        expect(del.status).toBe(200);
        expect(del.body.favorites).not.toContain(activeCardId);
        const list = await request(app).get('/users/me/favorites').set(auth(tokenA));
        expect(list.body).toEqual([]);
    });

    it('rejects a malformed card id with 400', async () => {
        const res = await request(app).post('/users/me/favorites/not-an-id').set(auth(tokenA));
        expect(res.status).toBe(400);
    });

    it('404s a non-existent card id', async () => {
        const ghost = new mongoose.Types.ObjectId().toString();
        const res = await request(app).post(`/users/me/favorites/${ghost}`).set(auth(tokenA));
        expect(res.status).toBe(404);
    });

    it('does not favorite a banned/non-active card', async () => {
        const res = await request(app).post(`/users/me/favorites/${bannedCardId}`).set(auth(tokenA));
        expect(res.status).toBe(404);
    });

    it('a banned card that was already favorited is filtered out of GET', async () => {
        // favorite an active card, then ban it directly; it should drop from the list
        await request(app).post(`/users/me/favorites/${activeCardId}`).set(auth(tokenA));
        await Card.findByIdAndUpdate(activeCardId, { status: 'banned' });
        const res = await request(app).get('/users/me/favorites').set(auth(tokenA));
        expect(res.body.find(c => c._id === activeCardId)).toBeUndefined();
        // restore for isolation hygiene
        await Card.findByIdAndUpdate(activeCardId, { status: 'active' });
    });
});
