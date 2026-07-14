/**
 * E2E test harness: boots the REAL Express/Mongoose API against an IN-MEMORY
 * MongoDB on port 8182.
 *
 * WHY THIS EXISTS:
 *   - Never touches Atlas or David's dev db (port 8181 is untouched).
 *   - ACCESS_TOKEN_TTL=8s so "a long session" happens in seconds — required for
 *     the chat-token-expiry spec.
 *   - Seeds alice + bob + a pre-existing conversation so every spec can login
 *     and open chat without extra setup steps.
 *   - Exposes GET /_e2e_health so Playwright's webServer url-probe gets a 200
 *     only AFTER seeding is complete. This means tests never start before data exists.
 *
 * Called by playwright.config.js webServer; do not run directly.
 */
'use strict';

const path = require('path');

/* ------------------------------------------------------------------ *
 * Env vars MUST be set before any require() reaches the app modules. *
 * ------------------------------------------------------------------ */
process.env.JWT_SECRET           ||= 'e2e-test-secret-not-for-production';
process.env.GOOGLE_CLIENT_ID     ||= 'e2e-stub';
process.env.GOOGLE_CLIENT_SECRET ||= 'e2e-stub';
process.env.CLIENT_URL            = 'http://localhost:5174';
process.env.ALLOWED_ORIGINS       = 'http://localhost:5174';
process.env.SERVER_URL            = 'http://localhost:8182';
process.env.PORT                  = '8182';
// DELIBERATE: tiny TTL so the token-expiry regression spec completes in
// seconds instead of hours. Do NOT raise this.
process.env.ACCESS_TOKEN_TTL      = '8s';

const API_DIR = path.resolve(__dirname, '../../apps/api');

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

(async () => {
    /* ---- In-memory Mongo ---- */
    const mongo = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongo.getUri();
    await mongoose.connect(mongo.getUri());

    /* ---- Import models AFTER mongoose is connected ---- */
    const User         = require(path.join(API_DIR, 'src/users/models/User'));
    const Conversation = require(path.join(API_DIR, 'src/chat/models/Conversation'));
    const Message      = require(path.join(API_DIR, 'src/chat/models/Message'));

    /* ---- Seed test users ---- */
    const pass = await bcrypt.hash('Password1!', 10);
    const mk = (over) => new User({
        password: pass, phone: '0501234567', age: 30,
        birthDate: new Date('1995-06-15'),
        address: { country: 'Wonderland', city: 'Capital' },
        onboardingComplete: true,
        ...over,
    }).save();

    const alice = await mk({
        name: 'Alice', lastName: 'Poster',
        email: 'alice@verify.test',
        job: 'Photographer', gender: 'Female',
    });
    const bob = await mk({
        name: 'Bob', lastName: 'Viewer',
        email: 'bob@verify.test',
        job: 'Builder', gender: 'Male',
        following: [String(alice._id)],
    });

    /* ---- Pre-seed a conversation so the chat page opens a real thread ---- */
    const convo = await new Conversation({ fromUser: bob._id, toUser: alice._id }).save();
    await new Message({
        conversationId: convo._id,
        fromUser: alice._id,
        toUser: bob._id,
        text: 'Hey Bob, you there?',
    }).save();

    /* ---- Boot the real API (require.main check in app.js is false → no auto-listen) ---- */
    const { app, server } = require(path.join(API_DIR, 'src/app.js'));

    /* ---- Health endpoint so Playwright's url probe gets a 200 after seeding ---- */
    app.get('/_e2e_health', (_req, res) => res.json({ ok: true }));

    server.listen(8182, '0.0.0.0', () => {
        console.log('E2E-API-READY port=8182 mongo=in-memory TTL=8s');
        console.log('SEED_IDS ' + JSON.stringify({
            alice: String(alice._id),
            bob:   String(bob._id),
            convo: String(convo._id),
        }));
    });
})().catch(err => {
    console.error('E2E api-server BOOT FAILED:', err);
    process.exit(1);
});
