// Phase F / F5 — the agent image approval queue (§7).
//
// The property under test is the one §7 asks for: "generated images land in a
// small admin approval list before publishing". Nothing here may reach a feed
// on its own. So the tests care about exactly three things —
//   1. queuing produces something INERT (no Card exists yet),
//   2. approve is the only thing that publishes, and it publishes as the AGENT,
//   3. reject publishes nothing, ever.
//
// Cloudinary is never contacted: the queue service takes a URL, and the route
// test injects the upload boundary.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);

let mongoServer, PendingAgentImage, Card, User, svc, STATUS;

const mkUser = async (kind) => {
    const user = await new User({
        name: 'Maya', lastName: 'Ben-Ari',
        email: `${kind}-${new mongoose.Types.ObjectId()}@example.com`,
        password: 'Password1!',
        phone: '0501234567',
        age: 30, birthDate: '1995-06-15', address: {},
        kind,
    }).save();
    return user._id;
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());

    PendingAgentImage = requireFromHere('../src/agents/models/PendingAgentImage');
    Card = requireFromHere('../src/cards/models/Card');
    User = requireFromHere('../src/users/models/User');
    svc = requireFromHere('../src/agents/service/agentImagesSvc');
    STATUS = svc.STATUS;
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
    await PendingAgentImage.deleteMany({});
    await Card.deleteMany({});
    await User.deleteMany({});
});

const queue = async (over = {}) => {
    const agentUserId = over.agentUserId || (await mkUser('agent'));
    return svc.queuePendingImage({
        agentUserId,
        imageUrl: 'https://res.cloudinary.com/agents/pending/x.jpg',
        caption: 'morning run before the heat',
        prompt: 'a casual phone photo...',
        model: 'gemini-2.5-flash-image',
        ...over,
    });
};

describe('queuing — a generated image is a proposal, not a post', () => {
    it('lands as pending', async () => {
        const pending = await queue();
        expect(pending.status).toBe(STATUS.PENDING);
        expect(pending.publishedCardId).toBeFalsy();
    });

    it('CREATES NO CARD — nothing auto-publishes', async () => {
        await queue();
        expect(await Card.countDocuments({})).toBe(0);
    });

    it('keeps the prompt and model for forensics on a bad generation', async () => {
        const pending = await queue();
        expect(pending.prompt).toMatch(/casual phone photo/);
        expect(pending.model).toBe('gemini-2.5-flash-image');
    });

    it('refuses to queue against a human account', async () => {
        const humanId = await mkUser('human');
        await expect(queue({ agentUserId: humanId })).rejects.toMatchObject({ status: 400 });
    });

    it('requires an image url', async () => {
        const agentUserId = await mkUser('agent');
        await expect(svc.queuePendingImage({ agentUserId, imageUrl: '' }))
            .rejects.toMatchObject({ status: 400 });
    });
});

describe('the queue listing', () => {
    it('returns pending items oldest first — a queue, not a feed', async () => {
        const agentUserId = await mkUser('agent');
        const a = await queue({ agentUserId, caption: 'first' });
        const b = await queue({ agentUserId, caption: 'second' });
        // Make the ordering unambiguous regardless of same-millisecond writes.
        await PendingAgentImage.updateOne({ _id: a._id }, { $set: { createdAt: new Date('2026-07-01') } });
        await PendingAgentImage.updateOne({ _id: b._id }, { $set: { createdAt: new Date('2026-07-02') } });

        const list = await svc.listPendingImages({});
        expect(list.map((i) => i.caption)).toEqual(['first', 'second']);
    });

    it('excludes items that have been reviewed', async () => {
        const pending = await queue();
        await svc.rejectPendingImage({ id: pending._id, adminUserId: await mkUser('agent') });
        expect(await svc.listPendingImages({})).toHaveLength(0);
    });

    it('rejects an unknown status rather than silently returning everything', async () => {
        await expect(svc.listPendingImages({ status: 'nonsense' })).rejects.toMatchObject({ status: 400 });
    });

    it('caps the page size', async () => {
        const agentUserId = await mkUser('agent');
        for (let i = 0; i < 5; i++) await queue({ agentUserId });
        expect(await svc.listPendingImages({ limit: 2 })).toHaveLength(2);
    });
});

describe('approve — the ONLY path from a generated image to a post', () => {
    it('publishes a real Card authored by the AGENT, not the admin', async () => {
        const agentUserId = await mkUser('agent');
        const adminId = await mkUser('human');
        const pending = await queue({ agentUserId });

        const { card } = await svc.approvePendingImage({ id: pending._id, adminUserId: adminId });

        const cards = await Card.find({});
        expect(cards).toHaveLength(1);
        expect(String(cards[0].userId)).toBe(String(agentUserId));
        expect(String(cards[0].userId)).not.toBe(String(adminId));
        expect(cards[0].mediaUrl).toBe(pending.imageUrl);
        expect(cards[0].content).toBe('morning run before the heat');
        expect(card).toBeTruthy();
    });

    it('marks the row approved and records which card it became', async () => {
        const pending = await queue();
        const adminId = await mkUser('human');
        await svc.approvePendingImage({ id: pending._id, adminUserId: adminId });

        const row = await PendingAgentImage.findById(pending._id).lean();
        expect(row.status).toBe(STATUS.APPROVED);
        expect(row.publishedCardId).toBeTruthy();
        expect(String(row.reviewedBy)).toBe(String(adminId));
        expect(row.reviewedAt).toBeTruthy();
    });

    it('publishes exactly once even if approve is called twice', async () => {
        const pending = await queue();
        const adminId = await mkUser('human');

        await svc.approvePendingImage({ id: pending._id, adminUserId: adminId });
        await expect(svc.approvePendingImage({ id: pending._id, adminUserId: adminId }))
            .rejects.toMatchObject({ status: 409 });

        expect(await Card.countDocuments({})).toBe(1);
    });

    it('publishes exactly once under a concurrent double-approve', async () => {
        const pending = await queue();
        const adminId = await mkUser('human');

        // Two admins clicking at the same moment. Without the status-guarded
        // atomic claim, both would read 'pending' and both would publish.
        const results = await Promise.allSettled([
            svc.approvePendingImage({ id: pending._id, adminUserId: adminId }),
            svc.approvePendingImage({ id: pending._id, adminUserId: adminId }),
        ]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(await Card.countDocuments({})).toBe(1);
    });

    it('refuses to approve something already rejected', async () => {
        const pending = await queue();
        const adminId = await mkUser('human');
        await svc.rejectPendingImage({ id: pending._id, adminUserId: adminId });

        await expect(svc.approvePendingImage({ id: pending._id, adminUserId: adminId }))
            .rejects.toMatchObject({ status: 409 });
        expect(await Card.countDocuments({})).toBe(0);
    });

    it('404s on an unknown id', async () => {
        await expect(svc.approvePendingImage({
            id: new mongoose.Types.ObjectId(), adminUserId: new mongoose.Types.ObjectId(),
        })).rejects.toMatchObject({ status: 404 });
    });
});

describe('reject — publishes nothing, ever', () => {
    it('marks it rejected and creates NO card', async () => {
        const pending = await queue();
        const adminId = await mkUser('human');

        const rejected = await svc.rejectPendingImage({
            id: pending._id, adminUserId: adminId, note: 'six fingers',
        });

        expect(rejected.status).toBe(STATUS.REJECTED);
        expect(rejected.reviewNote).toBe('six fingers');
        expect(await Card.countDocuments({})).toBe(0);
    });

    it('keeps it out of the feed permanently — it cannot be approved later', async () => {
        const pending = await queue();
        const adminId = await mkUser('human');
        await svc.rejectPendingImage({ id: pending._id, adminUserId: adminId });

        await expect(svc.approvePendingImage({ id: pending._id, adminUserId: adminId }))
            .rejects.toMatchObject({ status: 409 });
        expect(await Card.countDocuments({})).toBe(0);
    });

    it('refuses to reject twice', async () => {
        const pending = await queue();
        const adminId = await mkUser('human');
        await svc.rejectPendingImage({ id: pending._id, adminUserId: adminId });
        await expect(svc.rejectPendingImage({ id: pending._id, adminUserId: adminId }))
            .rejects.toMatchObject({ status: 409 });
    });
});
