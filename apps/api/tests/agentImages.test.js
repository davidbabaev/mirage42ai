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

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);

let mongoServer, PendingAgentImage, Card, User, AgentPersona, svc, STATUS;

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
    AgentPersona = requireFromHere('../src/agents/models/AgentPersona');
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
    await AgentPersona.deleteMany({});
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

// Phase F / F5 follow-up — auto-publish, gated by moderation (§7).
//
// The whole point is that turning OFF the human review step does not turn off
// SAFETY. So the four cases that matter are: the toggle off still queues; the
// toggle on with a clean image publishes; the toggle on with a flagged image
// does NOT publish; and the toggle on with an image we could not check does NOT
// publish either (fail closed). The moderator is injected — Cloudinary is never
// contacted.
describe('auto-publish (opt-in) with a moderation gate', () => {
    const IMG = 'https://res.cloudinary.com/agents/image/upload/v1/agents/pending/x.png';

    const pass = () => vi.fn(async () => ({ ok: true, status: 'approved', provider: 'test' }));
    const flag = () => vi.fn(async () => ({ ok: false, status: 'rejected', reason: 'flagged-by-moderation', provider: 'test' }));
    const unavailable = () => vi.fn(async () => ({ ok: false, status: 'unavailable', reason: 'agent-cloudinary-not-configured', provider: 'test' }));

    const mkAgent = async ({ autoPublishImages } = {}) => {
        const agentUserId = await mkUser('agent');
        // autoPublishImages:undefined means "no persona at all" — used to prove
        // the default is the safe (queue) path.
        if (autoPublishImages !== undefined) {
            await new AgentPersona({
                userId: agentUserId, name: 'Maya', age: 31, locale: 'en-US', timezone: 'Asia/Jerusalem',
                autoPublishImages,
            }).save();
        }
        return agentUserId;
    };

    const submit = (agentUserId, moderateImpl) => svc.submitAndMaybePublish({
        agentUserId, imageUrl: IMG, caption: 'sunset from the roof', prompt: 'a phone photo...',
        model: 'gemini-3.1-flash-image', moderateImpl,
    });

    it('toggle OFF — still queues for review, publishes nothing, never even moderates', async () => {
        const agentUserId = await mkAgent({ autoPublishImages: false });
        const moderateImpl = pass();

        const result = await submit(agentUserId, moderateImpl);

        expect(result).toMatchObject({ status: STATUS.PENDING, autoPublish: false });
        expect(await Card.countDocuments({})).toBe(0);
        expect(moderateImpl).not.toHaveBeenCalled();
    });

    it('no persona at all — defaults to the safe path (queue, no publish)', async () => {
        const agentUserId = await mkAgent(); // no persona created
        const result = await submit(agentUserId, pass());

        expect(result.autoPublish).toBe(false);
        expect(result.status).toBe(STATUS.PENDING);
        expect(await Card.countDocuments({})).toBe(0);
    });

    it('toggle ON + clean image — publishes a real Card authored by the agent', async () => {
        const agentUserId = await mkAgent({ autoPublishImages: true });

        const result = await submit(agentUserId, pass());

        expect(result).toMatchObject({ autoPublish: true, published: true, status: STATUS.APPROVED });
        expect(result.cardId).toBeTruthy();

        const cards = await Card.find({});
        expect(cards).toHaveLength(1);
        expect(String(cards[0].userId)).toBe(String(agentUserId));
        expect(cards[0].content).toBe('sunset from the roof');

        const row = await PendingAgentImage.findById(result.id).lean();
        expect(row.status).toBe(STATUS.APPROVED);
        expect(row.autoApproved).toBe(true);
        expect(row.reviewedBy).toBeFalsy();          // no human acted
        expect(row.moderation.status).toBe('approved');
    });

    it('toggle ON + FLAGGED image — publishes NOTHING and holds it for a human', async () => {
        const agentUserId = await mkAgent({ autoPublishImages: true });

        const result = await submit(agentUserId, flag());

        expect(result).toMatchObject({ autoPublish: true, published: false, status: STATUS.PENDING });
        expect(await Card.countDocuments({})).toBe(0);

        const row = await PendingAgentImage.findById(result.id).lean();
        expect(row.status).toBe(STATUS.PENDING);      // still reviewable
        expect(row.autoApproved).toBeFalsy();
        expect(row.moderation.status).toBe('rejected');
        expect(row.reviewNote).toMatch(/auto-publish held/);
    });

    it('toggle ON + moderation UNAVAILABLE — fails closed, holds for a human', async () => {
        const agentUserId = await mkAgent({ autoPublishImages: true });

        const result = await submit(agentUserId, unavailable());

        expect(result.published).toBe(false);
        expect(result.status).toBe(STATUS.PENDING);
        expect(await Card.countDocuments({})).toBe(0);

        const row = await PendingAgentImage.findById(result.id).lean();
        expect(row.status).toBe(STATUS.PENDING);
        expect(row.moderation.status).toBe('unavailable');
    });

    it('a held image can still be approved by an admin afterwards — the queue path survives', async () => {
        const agentUserId = await mkAgent({ autoPublishImages: true });
        const adminId = await mkUser('human');

        const result = await submit(agentUserId, flag());
        expect(await Card.countDocuments({})).toBe(0);

        // The human gate still works on top of a moderation hold.
        await svc.approvePendingImage({ id: result.id, adminUserId: adminId });
        expect(await Card.countDocuments({})).toBe(1);
    });

    it('moderateAndPublish 409s on a row that is no longer pending', async () => {
        const agentUserId = await mkAgent({ autoPublishImages: true });
        const result = await submit(agentUserId, pass()); // publishes -> approved
        await expect(svc.moderateAndPublish({ id: result.id, moderateImpl: pass() }))
            .rejects.toMatchObject({ status: 409 });
    });
});
