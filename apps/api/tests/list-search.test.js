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

const FAKE_MEDIA_URL = 'https://fake.test/ls-card-media.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build a registration body; `over` overrides/adds fields.
const mkUser = (slug, over = {}) => ({
    name: 'Test', lastName: 'User',
    email: `${slug}.ls@example.com`,
    password: 'Password1!',
    phone: '0501234567',
    age: 30, birthDate: '1995-06-15',
    address: {},
    ...over,
});

// Create a card with an explicit title and category.
const newCard = (app, token, title, category = 'general') =>
    request(app).post('/cards').set('auth-token', token)
        .field('title', title)
        .field('content', `content for ${title}`)
        .field('category', category)
        .attach('media', Buffer.from('img'), { filename: 't.png', contentType: 'image/png' });

// Collect all pages from an OFFSET-cursor endpoint into one flat array.
const collectAll = async (app, token, basePath, limit) => {
    const items = [];
    let cursor;
    for (let guard = 0; guard < 200; guard++) {
        const sep = basePath.includes('?') ? '&' : '?';
        const url = `${basePath}${sep}limit=${limit}` +
            (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
        const res = await request(app).get(url).set('auth-token', token);
        expect(res.status).toBe(200);
        items.push(...res.body.items);
        if (!res.body.nextCursor) break;
        cursor = res.body.nextCursor;
    }
    return items;
};

// ── Test state ────────────────────────────────────────────────────────────────
let mongoServer, app;

// Users:
//   R  = requester (makes all API calls); name='Main',    age=40, country='Canada'
//   A  = Alice;                           name='Alice',   age=25, country='USA',    gender='Female'
//   B  = Bob;                             name='Bob',     age=35, country='UK',     gender='Male'
//   C  = Charlie;                         name='Charlie', age=20, country='USA',    gender='Male'
//   X  = Xavier;                          name='Xavier',  age=50, country='France', gender='Male'
//       X is used for block tests.
let tokenR, idR, tokenA, idA, tokenB, idB, tokenC, idC, tokenX, idX;

// Cards:
//   cardA1: title='Apple Cider',   category='food',  creator=A
//   cardA2: title='Tech Review',   category='tech',  creator=A
//   cardB1: title='Apple Pie',     category='food',  creator=B
//   cardX1: title='Xavier News',   category='news',  creator=X
// Likes:   R+A like cardA1 (2), C likes cardA2 (1), none for cardB1/cardX1
// Comments: R+A+C comment on cardB1 (3), R comments on cardA1 (1)
let cardA1Id, cardA2Id, cardB1Id, cardX1Id;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Stub cloudinary before importing the app so no real upload is attempted.
    const cloudinaryPath = requireFromHere.resolve(
        path.join(__dirname, '../src/utils/cloudinary')
    );
    requireFromHere.cache[cloudinaryPath] = {
        id: cloudinaryPath, filename: cloudinaryPath, loaded: true,
        exports: fakeCloudinary, children: [], paths: [],
    };

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;

    // Register users
    const rR = await request(app).post('/users').send(mkUser('ls-r', {
        name: 'Main',    age: 40, address: { country: 'Canada' },  gender: 'Male',
    }));
    tokenR = rR.body.token; idR = rR.body.safeUser._id;

    const rA = await request(app).post('/users').send(mkUser('ls-a', {
        name: 'Alice',   age: 25, address: { country: 'USA' },     gender: 'Female',
    }));
    tokenA = rA.body.token; idA = rA.body.safeUser._id;

    const rB = await request(app).post('/users').send(mkUser('ls-b', {
        name: 'Bob',     age: 35, address: { country: 'UK' },      gender: 'Male',
    }));
    tokenB = rB.body.token; idB = rB.body.safeUser._id;

    const rC = await request(app).post('/users').send(mkUser('ls-c', {
        name: 'Charlie', age: 20, address: { country: 'USA' },     gender: 'Male',
    }));
    tokenC = rC.body.token; idC = rC.body.safeUser._id;

    const rX = await request(app).post('/users').send(mkUser('ls-x', {
        name: 'Xavier',  age: 50, address: { country: 'France' },  gender: 'Male',
    }));
    tokenX = rX.body.token; idX = rX.body.safeUser._id;

    // Create cards
    const rA1 = await newCard(app, tokenA, 'Apple Cider', 'food');
    cardA1Id = String(rA1.body._id);

    const rA2 = await newCard(app, tokenA, 'Tech Review', 'tech');
    cardA2Id = String(rA2.body._id);

    const rB1 = await newCard(app, tokenB, 'Apple Pie', 'food');
    cardB1Id = String(rB1.body._id);

    const rX1 = await newCard(app, tokenX, 'Xavier News', 'news');
    cardX1Id = String(rX1.body._id);

    // Add likes: R and A like cardA1 (2 likes total)
    await request(app).patch(`/cards/${cardA1Id}`).set('auth-token', tokenR);
    await request(app).patch(`/cards/${cardA1Id}`).set('auth-token', tokenA);
    // C likes cardA2 (1 like)
    await request(app).patch(`/cards/${cardA2Id}`).set('auth-token', tokenC);

    // Add comments: cardB1 gets 3 (most commented), cardA1 gets 1
    await request(app).patch(`/cards/${cardB1Id}/comments`)
        .set('auth-token', tokenR).send({ commentText: 'comment 1' });
    await request(app).patch(`/cards/${cardB1Id}/comments`)
        .set('auth-token', tokenA).send({ commentText: 'comment 2' });
    await request(app).patch(`/cards/${cardB1Id}/comments`)
        .set('auth-token', tokenC).send({ commentText: 'comment 3' });
    await request(app).patch(`/cards/${cardA1Id}/comments`)
        .set('auth-token', tokenR).send({ commentText: 'single comment' });
}, 60_000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

// ─── GET /users/search ────────────────────────────────────────────────────────

describe('GET /users/search', () => {
    it('requires authentication', async () => {
        const res = await request(app).get('/users/search');
        expect(res.status).toBe(401);
    });

    it('returns { items, nextCursor } shape', async () => {
        const res = await request(app).get('/users/search').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
    });

    it('no filters returns all visible users', async () => {
        const res = await request(app).get('/users/search').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(u => String(u._id));
        // All 5 users should be visible (no blocks active here)
        expect(ids).toContain(idA);
        expect(ids).toContain(idB);
        expect(ids).toContain(idC);
        expect(ids).toContain(idX);
    });

    it('search narrows by name (substring match)', async () => {
        // 'ali' is a substring of 'Alice'
        const res = await request(app)
            .get('/users/search?search=ali')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(u => String(u._id));
        expect(ids).toContain(idA);           // Alice matches
        expect(ids).not.toContain(idB);       // Bob does not match
        expect(ids).not.toContain(idC);       // Charlie does not match
    });

    it('gender filter narrows results', async () => {
        const res = await request(app)
            .get('/users/search?gender=Female')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(u => String(u._id));
        expect(ids).toContain(idA);           // Alice is Female
        expect(ids).not.toContain(idB);       // Bob is Male
        expect(ids).not.toContain(idC);       // Charlie is Male
    });

    it('countries filter narrows results (single country)', async () => {
        const res = await request(app)
            .get('/users/search?countries=USA')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(u => String(u._id));
        expect(ids).toContain(idA);           // Alice → USA
        expect(ids).toContain(idC);           // Charlie → USA
        expect(ids).not.toContain(idB);       // Bob → UK
    });

    it('countries filter is case-insensitive and supports comma-separated list', async () => {
        // 'usa' (lower) should match stored 'USA'; 'uk' should match 'UK'
        const res = await request(app)
            .get('/users/search?countries=usa,uk')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(u => String(u._id));
        expect(ids).toContain(idA);           // Alice → USA
        expect(ids).toContain(idC);           // Charlie → USA
        expect(ids).toContain(idB);           // Bob → UK
        expect(ids).not.toContain(idX);       // Xavier → France
    });

    it('sort=youngest returns youngest user first (age ascending)', async () => {
        const res = await request(app)
            .get('/users/search?sort=youngest')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        // Charlie has the lowest age (20)
        expect(String(res.body.items[0]._id)).toBe(idC);
    });

    it('sort=oldest returns oldest user first (age descending)', async () => {
        const res = await request(app)
            .get('/users/search?sort=oldest')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        // Xavier has the highest age (50)
        expect(String(res.body.items[0]._id)).toBe(idX);
    });

    it('sort=az returns names in ascending order', async () => {
        const res = await request(app)
            .get('/users/search?sort=az')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        // 'Alice' sorts first alphabetically among Main/Alice/Bob/Charlie/Xavier
        expect(String(res.body.items[0]._id)).toBe(idA);
    });

    it('sort=za returns names in descending order', async () => {
        const res = await request(app)
            .get('/users/search?sort=za')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        // 'Xavier' sorts last (Z→A), so it's first in descending order
        expect(String(res.body.items[0]._id)).toBe(idX);
    });

    it('pagination: limit=2 returns 2 items and a nextCursor when more remain', async () => {
        // We have 5 users, so limit=2 should always have more
        const res = await request(app)
            .get('/users/search?limit=2')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(2);
        expect(typeof res.body.nextCursor).toBe('string');
    });

    it('pagination: paging through all users yields no duplicates and ends with null', async () => {
        const items = await collectAll(app, tokenR, '/users/search', 2);
        const ids = items.map(u => String(u._id));
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);   // no duplicates
        // All 5 users present
        expect(unique.has(idR)).toBe(true);
        expect(unique.has(idA)).toBe(true);
        expect(unique.has(idB)).toBe(true);
        expect(unique.has(idC)).toBe(true);
        expect(unique.has(idX)).toBe(true);
    });

    it('block-aware: blocked user (either direction) never appears', async () => {
        // Xavier blocks R → Xavier must be hidden from R's search
        await request(app).patch(`/users/${idR}/block`).set('auth-token', tokenX);

        const res = await request(app).get('/users/search').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.map(u => String(u._id))).not.toContain(idX);

        // Cleanup
        await request(app).patch(`/users/${idR}/block`).set('auth-token', tokenX);
    });

    it('malformed cursor → 400', async () => {
        const res = await request(app)
            .get('/users/search?cursor=not-a-valid-cursor')
            .set('auth-token', tokenR);
        expect(res.status).toBe(400);
    });
});

// ─── GET /users/countries ─────────────────────────────────────────────────────

describe('GET /users/countries', () => {
    it('requires authentication', async () => {
        const res = await request(app).get('/users/countries');
        expect(res.status).toBe(401);
    });

    it('returns { countries: [...] } shape', async () => {
        const res = await request(app).get('/users/countries').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.countries)).toBe(true);
    });

    it('includes all distinct non-empty countries visible to the requester', async () => {
        const res = await request(app).get('/users/countries').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const list = res.body.countries;
        // Canada (R), USA (A+C), UK (B), France (X) must all be present
        expect(list).toContain('Canada');
        expect(list).toContain('USA');
        expect(list).toContain('UK');
        expect(list).toContain('France');
    });

    it('countries list is sorted alphabetically', async () => {
        const res = await request(app).get('/users/countries').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const list = res.body.countries;
        const sorted = [...list].sort((a, b) => a.localeCompare(b));
        expect(list).toEqual(sorted);
    });

    it('block-aware: unique country of a blocked user is excluded', async () => {
        // France is only held by Xavier. Xavier blocks R → France must disappear.
        await request(app).patch(`/users/${idR}/block`).set('auth-token', tokenX);

        const res = await request(app).get('/users/countries').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.countries).not.toContain('France');

        // Cleanup
        await request(app).patch(`/users/${idR}/block`).set('auth-token', tokenX);
    });
});

// ─── GET /cards/search ────────────────────────────────────────────────────────

describe('GET /cards/search', () => {
    it('requires authentication', async () => {
        const res = await request(app).get('/cards/search');
        expect(res.status).toBe(401);
    });

    it('returns { items, nextCursor } shape', async () => {
        const res = await request(app).get('/cards/search').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('nextCursor');
    });

    it('no filters returns all active cards', async () => {
        const res = await request(app).get('/cards/search').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(c => String(c._id));
        expect(ids).toContain(cardA1Id);
        expect(ids).toContain(cardA2Id);
        expect(ids).toContain(cardB1Id);
        expect(ids).toContain(cardX1Id);
    });

    it('search by title narrows results', async () => {
        // 'apple' matches 'Apple Cider' (cardA1) and 'Apple Pie' (cardB1)
        const res = await request(app)
            .get('/cards/search?search=apple')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(c => String(c._id));
        expect(ids).toContain(cardA1Id);
        expect(ids).toContain(cardB1Id);
        expect(ids).not.toContain(cardA2Id);   // 'Tech Review' has no 'apple'
        expect(ids).not.toContain(cardX1Id);   // 'Xavier News' has no 'apple'
    });

    it('search by creator name returns that creator\'s cards', async () => {
        // 'alice' matches user Alice's name; Alice created cardA1 + cardA2.
        // Neither card title contains 'alice', so this tests the creator-name path.
        const res = await request(app)
            .get('/cards/search?search=alice')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(c => String(c._id));
        expect(ids).toContain(cardA1Id);
        expect(ids).toContain(cardA2Id);
        expect(ids).not.toContain(cardB1Id);   // Bob's card
        expect(ids).not.toContain(cardX1Id);   // Xavier's card
    });

    it('categories filter narrows to matching cards', async () => {
        const res = await request(app)
            .get('/cards/search?categories=food')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(c => String(c._id));
        expect(ids).toContain(cardA1Id);       // food
        expect(ids).toContain(cardB1Id);       // food
        expect(ids).not.toContain(cardA2Id);   // tech
        expect(ids).not.toContain(cardX1Id);   // news
    });

    it('categories filter supports comma-separated list', async () => {
        const res = await request(app)
            .get('/cards/search?categories=food,tech')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(c => String(c._id));
        expect(ids).toContain(cardA1Id);       // food
        expect(ids).toContain(cardB1Id);       // food
        expect(ids).toContain(cardA2Id);       // tech
        expect(ids).not.toContain(cardX1Id);   // news
    });

    it('creatorId filter narrows to one author\'s cards', async () => {
        const res = await request(app)
            .get(`/cards/search?creatorId=${idA}`)
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(c => String(c._id));
        expect(ids).toContain(cardA1Id);
        expect(ids).toContain(cardA2Id);
        expect(ids).not.toContain(cardB1Id);
        expect(ids).not.toContain(cardX1Id);
    });

    it('sort=newest returns most recently created card first', async () => {
        // Cards were created in order: A1, A2, B1, X1. Xavier's card is newest.
        const res = await request(app)
            .get('/cards/search?sort=newest')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        expect(String(res.body.items[0]._id)).toBe(cardX1Id);
    });

    it('sort=oldest returns oldest card first', async () => {
        // cardA1 was created first
        const res = await request(app)
            .get('/cards/search?sort=oldest')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        expect(String(res.body.items[0]._id)).toBe(cardA1Id);
    });

    it('sort=most liked returns card with most likes first', async () => {
        // cardA1 has 2 likes (R + A), all others have ≤1
        const res = await request(app)
            .get('/cards/search?sort=most liked')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        expect(String(res.body.items[0]._id)).toBe(cardA1Id);
    });

    it('sort=most commented returns card with most comments first', async () => {
        // cardB1 has 3 comments (R + A + C), cardA1 has 1
        const res = await request(app)
            .get('/cards/search?sort=most commented')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        expect(String(res.body.items[0]._id)).toBe(cardB1Id);
    });

    it('pagination: limit=2 returns 2 items and a nextCursor when more remain', async () => {
        // 4 cards total; limit=2 means there's a next page
        const res = await request(app)
            .get('/cards/search?limit=2')
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(2);
        expect(typeof res.body.nextCursor).toBe('string');
    });

    it('pagination: paging through all cards yields no duplicates and ends null', async () => {
        const items = await collectAll(app, tokenR, '/cards/search', 2);
        const ids = items.map(c => String(c._id));
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);   // no duplicates
        // All 4 cards must be present
        expect(unique.has(cardA1Id)).toBe(true);
        expect(unique.has(cardA2Id)).toBe(true);
        expect(unique.has(cardB1Id)).toBe(true);
        expect(unique.has(cardX1Id)).toBe(true);
    });

    it('pagination with sort=most liked: paging yields no duplicates', async () => {
        const items = await collectAll(app, tokenR, '/cards/search?sort=most liked', 2);
        const ids = items.map(c => String(c._id));
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
        expect(ids.length).toBe(4);
    });

    it('block-aware: blocked author\'s cards never appear', async () => {
        // Xavier blocks R → Xavier's cards must be hidden from R's search
        await request(app).patch(`/users/${idR}/block`).set('auth-token', tokenX);

        const res = await request(app).get('/cards/search').set('auth-token', tokenR);
        expect(res.status).toBe(200);
        const ids = res.body.items.map(c => String(c._id));
        expect(ids).not.toContain(cardX1Id);   // Xavier's card hidden
        expect(ids).toContain(cardA1Id);        // others still visible

        // Cleanup
        await request(app).patch(`/users/${idR}/block`).set('auth-token', tokenX);
    });

    it('block-aware: creatorId of a blocked user returns empty', async () => {
        // Xavier blocks R → querying Xavier's cards returns empty
        await request(app).patch(`/users/${idR}/block`).set('auth-token', tokenX);

        const res = await request(app)
            .get(`/cards/search?creatorId=${idX}`)
            .set('auth-token', tokenR);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(0);
        expect(res.body.nextCursor).toBeNull();

        // Cleanup
        await request(app).patch(`/users/${idR}/block`).set('auth-token', tokenX);
    });

    it('malformed cursor → 400', async () => {
        const res = await request(app)
            .get('/cards/search?cursor=not-a-valid-cursor')
            .set('auth-token', tokenR);
        expect(res.status).toBe(400);
    });
});
