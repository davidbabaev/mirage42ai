// Safe placeholder env vars before any app code is loaded.
process.env.GOOGLE_CLIENT_ID    ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET          ||= 'test-jwt-secret';
process.env.SERVER_URL          ||= 'http://localhost:8181';
process.env.CLIENT_URL          ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const FAKE_MEDIA_URL = 'https://fake.test/admin-card-media.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

// ── Helpers ───────────────────────────────────────────────────────────────────

const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.ap@example.com`,
    password: 'Password1!',
    phone: `050${slug.replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
    age: 30, birthDate: '1995-06-15',
    address: { country: 'USA' },
    gender: 'Male',
    ...over,
});

const mkCard = (app, token, title, category = 'Technology') =>
    request(app).post('/cards').set('auth-token', token)
        .field('title', title)
        .field('content', `content for ${title}`)
        .field('category', category)
        .attach('media', Buffer.from('img'), { filename: 't.png', contentType: 'image/png' });

// ── Test state ─────────────────────────────────────────────────────────────────
let mongoServer, app;
let adminToken, adminId;
let userToken;
// IDs of cards created in seed
const cardIds = [];

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Stub cloudinary before importing the app.
    const cloudinaryPath = requireFromHere.resolve(
        path.join(__dirname, '../src/utils/cloudinary'),
    );
    requireFromHere.cache[cloudinaryPath] = {
        id: cloudinaryPath, filename: cloudinaryPath, loaded: true,
        exports: fakeCloudinary, children: [], paths: [],
    };

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    // Create admin user via registration, then directly set isAdmin in DB
    // (auth middleware reads isAdmin from DB, so no re-login needed).
    const adminReg = await request(app).post('/users').send(mkUser('ap-admin', {
        name: 'AdminFirst', lastName: 'AdminLast',
    }));
    expect(adminReg.status).toBe(200);
    adminToken = adminReg.body.token;
    adminId = adminReg.body.safeUser._id;

    // Promote to admin directly in DB (auth reads isAdmin fresh from DB each request).
    const UserModel = requireFromHere(path.join(__dirname, '../src/users/models/User'));
    await UserModel.findByIdAndUpdate(adminId, { isAdmin: true });

    // Create a regular (non-admin) user for 403 tests.
    const userReg = await request(app).post('/users').send(mkUser('ap-user1', {
        name: 'Regular', lastName: 'Joe', gender: 'Female', address: { country: 'UK' }, age: 25,
    }));
    expect(userReg.status).toBe(200);
    userToken = userReg.body.token;

    // Create 20 more regular users (total regular users = 21 + 1 admin = 22 total).
    for (let i = 2; i <= 21; i++) {
        const r = await request(app).post('/users').send(mkUser(`ap-user${i}`, {
            name: `User${String(i).padStart(2, '0')}`, lastName: 'Test',
            gender: i % 2 === 0 ? 'Male' : 'Female',
            address: { country: i % 3 === 0 ? 'UK' : 'USA' },
            age: 20 + (i % 30),
        }));
        expect(r.status).toBe(200);
    }

    // Create 25 active cards + 5 banned cards (30 total).
    for (let i = 1; i <= 25; i++) {
        const cat = i % 2 === 0 ? 'Technology' : 'Science & Tech';
        const r = await mkCard(app, adminToken, `Active Card ${String(i).padStart(2, '0')}`, cat);
        expect(r.status).toBe(200);
        cardIds.push(r.body._id);
    }
    for (let i = 1; i <= 5; i++) {
        const r = await mkCard(app, adminToken, `Banned Card ${i}`, 'Technology');
        expect(r.status).toBe(200);
        cardIds.push(r.body._id);
        // Ban the card (admin can ban).
        await request(app).patch(`/cards/${r.body._id}/ban`).set('auth-token', adminToken);
    }
}, 120_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

// ─── GET /users/admin ─────────────────────────────────────────────────────────

describe('GET /users/admin', () => {
    it('returns 401 without auth token', async () => {
        const res = await request(app).get('/users/admin');
        expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin user', async () => {
        const res = await request(app).get('/users/admin').set('auth-token', userToken);
        expect(res.status).toBe(403);
    });

    it('returns { items, total, page, limit } shape for admin', async () => {
        const res = await request(app).get('/users/admin').set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(typeof res.body.total).toBe('number');
        expect(typeof res.body.page).toBe('number');
        expect(typeof res.body.limit).toBe('number');
    });

    it('page 1 with limit=10 returns 10 items and the correct total', async () => {
        const res = await request(app)
            .get('/users/admin?page=1&limit=10')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(10);
        expect(res.body.total).toBe(22); // 1 admin + 21 regular users
        expect(res.body.page).toBe(1);
        expect(res.body.limit).toBe(10);
    });

    it('page 2 has no overlap with page 1', async () => {
        const [r1, r2] = await Promise.all([
            request(app).get('/users/admin?page=1&limit=10').set('auth-token', adminToken),
            request(app).get('/users/admin?page=2&limit=10').set('auth-token', adminToken),
        ]);
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        const ids1 = new Set(r1.body.items.map(u => String(u._id)));
        const ids2 = r2.body.items.map(u => String(u._id));
        for (const id of ids2) expect(ids1.has(id)).toBe(false);
    });

    it('search filter narrows results and updates total', async () => {
        // Names are stored lowercase by normalizeUser; search is case-insensitive.
        const res = await request(app)
            .get('/users/admin?search=adminfirst')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.items[0].name).toBe('adminfirst');
    });

    it('role=admin filter returns only admin users', async () => {
        const res = await request(app)
            .get('/users/admin?role=admin')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.items[0].isAdmin).toBe(true);
    });

    it('gender filter narrows results', async () => {
        const res = await request(app)
            .get('/users/admin?gender=Female')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        // Regular user ap-user1 is Female + odd-indexed users are Female
        expect(res.body.total).toBeGreaterThan(0);
        for (const u of res.body.items) expect(u.gender).toBe('Female');
    });

    it('sort=name_asc orders items alphabetically by name', async () => {
        const res = await request(app)
            .get('/users/admin?sort=name_asc&limit=22')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        // Names are stored lowercase; verify ascending order
        const names = res.body.items.map(u => u.name.toLowerCase());
        for (let i = 1; i < names.length; i++) {
            expect(names[i].localeCompare(names[i - 1])).toBeGreaterThanOrEqual(0);
        }
    });

    it('each item has expected admin fields (no password)', async () => {
        const res = await request(app)
            .get('/users/admin?limit=1')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        const u = res.body.items[0];
        expect(u).toHaveProperty('name');
        expect(u).toHaveProperty('email');
        expect(u).toHaveProperty('isAdmin');
        expect(u).toHaveProperty('followersCount');
        expect(u).toHaveProperty('postsCount');
        expect(u.password).toBeUndefined();
    });
});

// ─── GET /cards/admin ─────────────────────────────────────────────────────────

describe('GET /cards/admin', () => {
    it('returns 401 without auth token', async () => {
        const res = await request(app).get('/cards/admin');
        expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin user', async () => {
        const res = await request(app).get('/cards/admin').set('auth-token', userToken);
        expect(res.status).toBe(403);
    });

    it('returns { items, total, page, limit } shape for admin', async () => {
        const res = await request(app).get('/cards/admin').set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(typeof res.body.total).toBe('number');
        expect(typeof res.body.page).toBe('number');
        expect(typeof res.body.limit).toBe('number');
    });

    it('page 1 with limit=10 returns 10 items and total=30', async () => {
        const res = await request(app)
            .get('/cards/admin?page=1&limit=10')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(10);
        expect(res.body.total).toBe(30);
        expect(res.body.page).toBe(1);
        expect(res.body.limit).toBe(10);
    });

    it('page 2 has no overlap with page 1', async () => {
        const [r1, r2] = await Promise.all([
            request(app).get('/cards/admin?page=1&limit=10').set('auth-token', adminToken),
            request(app).get('/cards/admin?page=2&limit=10').set('auth-token', adminToken),
        ]);
        const ids1 = new Set(r1.body.items.map(c => String(c._id)));
        const ids2 = r2.body.items.map(c => String(c._id));
        for (const id of ids2) expect(ids1.has(id)).toBe(false);
    });

    it('status=banned filter returns only banned cards with correct total', async () => {
        const res = await request(app)
            .get('/cards/admin?status=banned')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(5);
        for (const c of res.body.items) expect(c.status).toBe('banned');
    });

    it('status=active filter returns only active cards', async () => {
        const res = await request(app)
            .get('/cards/admin?status=active')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(25);
        for (const c of res.body.items) expect(c.status).toBe('active');
    });

    it('search filter on title narrows results', async () => {
        const res = await request(app)
            .get('/cards/admin?search=Banned+Card')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(5);
        for (const c of res.body.items) {
            expect(c.title.toLowerCase()).toContain('banned card');
        }
    });

    it('category filter narrows results', async () => {
        const res = await request(app)
            .get('/cards/admin?category=Technology')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        // 12 even-numbered active cards + 5 banned = 17 Technology cards
        expect(res.body.total).toBe(17);
        for (const c of res.body.items) expect(c.category).toBe('Technology');
    });

    it('creator filter matches by name (case-insensitive)', async () => {
        // Names are stored lowercase; the filter uses a case-insensitive regex.
        const res = await request(app)
            .get('/cards/admin?creator=adminfirst')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        // All 30 cards were created by the admin user
        expect(res.body.total).toBe(30);
    });

    it('sort=oldest orders by createdAt ascending', async () => {
        const res = await request(app)
            .get('/cards/admin?sort=oldest&limit=30')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        const dates = res.body.items.map(c => new Date(c.createdAt).getTime());
        for (let i = 1; i < dates.length; i++) {
            expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
        }
    });

    it('each item has expected fields (creator, likesCount, commentsCount)', async () => {
        const res = await request(app)
            .get('/cards/admin?limit=1')
            .set('auth-token', adminToken);
        expect(res.status).toBe(200);
        const c = res.body.items[0];
        expect(c).toHaveProperty('title');
        expect(c).toHaveProperty('status');
        expect(c).toHaveProperty('likesCount');
        expect(c).toHaveProperty('commentsCount');
        expect(c).toHaveProperty('creator');
        expect(c.creator).toHaveProperty('name');
        expect(c.password).toBeUndefined();
    });
});
