// Google sign-in must be a find-or-create, not a blind insert. Regression test
// for the E11000 duplicate-key crash: a user who registered with email/password
// (googleId: null) then signs in with Google — the callback must LINK the
// googleId onto the existing account, never insert a second row with the same
// (unique-indexed) email.
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let User;
let findOrCreateGoogleUser;

const profileFor = ({ id, email, name = 'Jane Doe' }) => ({
    id,
    displayName: name,
    emails: email ? [{ value: email }] : [],
    photos: [{ value: 'https://example.com/pic.png' }],
});

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    // Load the strategy first — it require()s the User model (CJS), registering
    // it on the shared mongoose singleton. Pull the model back off mongoose
    // rather than re-importing User.js, which would compile it a second time
    // (ESM + CJS registries) and throw OverwriteModelError.
    ({ findOrCreateGoogleUser } = await import('../src/auth/googleStrategy.js'));
    User = mongoose.model('User');
    // Build the unique email index in the in-memory DB — without it the very
    // collision this test guards against could not occur.
    await User.init();
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
});

describe('findOrCreateGoogleUser (Google sign-in find-or-create + linking)', () => {
    it('links googleId onto an existing email/password account instead of inserting a duplicate', async () => {
        const existing = await User.create({
            name: 'jane',
            lastName: 'doe',
            email: 'jane@example.com',
            password: 'Aa1!aaaa',
        });
        expect(existing.googleId).toBeNull();

        const user = await findOrCreateGoogleUser(
            profileFor({ id: 'google-abc', email: 'jane@example.com' })
        );

        // Same account, now linked — not a new row.
        expect(user._id.toString()).toBe(existing._id.toString());
        expect(user.googleId).toBe('google-abc');
        expect(await User.countDocuments({})).toBe(1);
    });

    it('creates a new user when no account exists for that email or googleId', async () => {
        const user = await findOrCreateGoogleUser(
            profileFor({ id: 'google-new', email: 'new@example.com', name: 'New Person' })
        );

        expect(user.googleId).toBe('google-new');
        expect(user.email).toBe('new@example.com');
        expect(user.name).toBe('new');
        expect(user.lastName).toBe('person');
        expect(await User.countDocuments({})).toBe(1);
    });

    it('returns the same account on a second Google login (matched by googleId)', async () => {
        const first = await findOrCreateGoogleUser(
            profileFor({ id: 'google-xyz', email: 'repeat@example.com' })
        );
        const second = await findOrCreateGoogleUser(
            profileFor({ id: 'google-xyz', email: 'repeat@example.com' })
        );

        expect(second._id.toString()).toBe(first._id.toString());
        expect(await User.countDocuments({})).toBe(1);
    });

    it('survives the concurrent-callback race without E11000 (two parallel first-time logins)', async () => {
        const profile = profileFor({ id: 'google-race', email: 'race@example.com' });

        const [a, b] = await Promise.all([
            findOrCreateGoogleUser(profile),
            findOrCreateGoogleUser(profile),
        ]);

        expect(a._id.toString()).toBe(b._id.toString());
        expect(await User.countDocuments({})).toBe(1);
    });
});
