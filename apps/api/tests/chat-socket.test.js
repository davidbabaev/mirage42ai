process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { io as ioClient } from 'socket.io-client';

const FAKE_MEDIA_URL = 'https://fake.test/uploaded-card-media.png';
const fakeCloudinary = vi.fn(async () => FAKE_MEDIA_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

const userAlice = {
    name: 'Alice',
    lastName: 'Aaron',
    email: 'chatsocket-alice@example.com',
    password: 'Password1!',
    phone: '0501234567',
    age: 30,
    birthDate: '1995-06-15',
    address: {},
};

let mongoServer;
let app;
let server;
let port;
let tokenA;
let userAId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    const cloudinaryPath = requireFromHere.resolve(
        path.join(__dirname, '../src/utils/cloudinary')
    );
    requireFromHere.cache[cloudinaryPath] = {
        id: cloudinaryPath,
        filename: cloudinaryPath,
        loaded: true,
        exports: fakeCloudinary,
        children: [],
        paths: [],
    };

    const mod = await import('../src/app.js');
    app = mod.app ?? mod.default?.app;
    server = mod.server ?? mod.default?.server;

    const reg = await request(app).post('/users').send(userAlice);
    if (reg.status !== 200) {
        throw new Error(`Register failed: ${reg.status} ${reg.text}`);
    }
    tokenA = reg.body.token;
    userAId = reg.body.safeUser._id;

    // Bind the HTTP server (with attached socket.io) to an ephemeral port so a
    // real socket.io-client can connect to it.
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, () => resolve());
    });
    port = server.address().port;
}, 60_000);

afterAll(async () => {
    if (server && server.listening) {
        await new Promise((resolve) => server.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

describe('chat socket: send-message error handling', () => {
    it('does not produce an unhandled rejection when send-message fails inside the async handler', async () => {
        // Install a transient unhandled-rejection listener for this test only.
        const rejections = [];
        const rejectionHandler = (reason) => rejections.push(reason);
        process.on('unhandledRejection', rejectionHandler);

        let clientSocket;
        try {
            clientSocket = ioClient(`http://localhost:${port}`, {
                auth: { token: tokenA },
                transports: ['websocket'],
                forceNew: true,
                reconnection: false,
            });

            await new Promise((resolve, reject) => {
                clientSocket.once('connect', resolve);
                clientSocket.once('connect_error', reject);
            });

            // Trigger: toUser === sender's own userId. getOrCreateConversation
            // throws `cannot start a conversation with yourself` synchronously
            // from inside the async send-message handler. Pre-fix the handler
            // has no try/catch so the rejection is unhandled (and in production
            // would crash Node v15+ by default).
            clientSocket.emit('send-message', { toUser: userAId, text: 'to-self' });

            // Give the async handler a window to throw and (post-fix) catch.
            await new Promise((resolve) => setTimeout(resolve, 400));
        } finally {
            process.off('unhandledRejection', rejectionHandler);
            if (clientSocket) clientSocket.disconnect();
        }

        expect(
            rejections,
            `Got unhandled rejection(s): ${rejections.map(r => r?.message ?? String(r)).join(' | ')}`
        ).toHaveLength(0);

        // Belt-and-suspenders: the express side of the same process must still
        // be alive after the bad emit.
        const res = await request(app).get('/users');
        expect(res.status).toBe(200);
    });
});
