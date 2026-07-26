// Phase F / F2 — the AgentPersona model (master-plan §5, §6).
//
// The validation rules worth testing are the ones that are SAFETY RAILS rather
// than formatting: an agent must never present as a minor, active hours must be
// real hours, and the budget caps must not be negative (a negative cap would
// read as "unlimited" to a naive `spent < cap` check).
//
// Safe placeholder env vars before any app code is loaded.
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

let mongoServer, AgentPersona;

const validPersona = (over = {}) => ({
    userId: new mongoose.Types.ObjectId(),
    name: 'Test Persona',
    age: 30,
    locale: 'en-US',
    timezone: 'Asia/Jerusalem',
    ...over,
});

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.DB_CONNECTION_STRING = mongoServer.getUri();
    await mongoose.connect(mongoServer.getUri());
    AgentPersona = requireFromHere('../src/agents/models/AgentPersona');
    await AgentPersona.init(); // build indexes, so the unique test is meaningful
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
    await AgentPersona.deleteMany({});
});

describe('AgentPersona — required identity', () => {
    it('accepts a minimal valid persona', async () => {
        const doc = new AgentPersona(validPersona());
        await expect(doc.validate()).resolves.toBeUndefined();
    });

    it.each(['userId', 'name', 'age', 'locale', 'timezone'])(
        'requires %s',
        async (field) => {
            const data = validPersona();
            delete data[field];
            await expect(new AgentPersona(data).validate()).rejects.toThrow(
                new RegExp(field)
            );
        }
    );
});

describe('AgentPersona — safety rails', () => {
    it('REJECTS an under-18 persona (an agent must never present as a minor)', async () => {
        await expect(
            new AgentPersona(validPersona({ age: 17 })).validate()
        ).rejects.toThrow(/age/);
    });

    it('accepts exactly 18', async () => {
        await expect(
            new AgentPersona(validPersona({ age: 18 })).validate()
        ).resolves.toBeUndefined();
    });

    it('rejects an out-of-range active hour', async () => {
        await expect(
            new AgentPersona(validPersona({ activeHours: { start: 8, end: 24 } })).validate()
        ).rejects.toThrow(/activeHours/);
        await expect(
            new AgentPersona(validPersona({ activeHours: { start: -1, end: 20 } })).validate()
        ).rejects.toThrow(/activeHours/);
    });

    it('ALLOWS a window that wraps midnight (a night owl is a real person)', async () => {
        await expect(
            new AgentPersona(validPersona({ activeHours: { start: 22, end: 2 } })).validate()
        ).resolves.toBeUndefined();
    });

    it('rejects a negative budget cap (it would read as "unlimited")', async () => {
        await expect(
            new AgentPersona(validPersona({ dailyBudget: { llmCalls: -1 } })).validate()
        ).rejects.toThrow(/dailyBudget/);
    });

    it('rejects an unknown relationship status', async () => {
        await expect(
            new AgentPersona(validPersona({ relationship: { status: 'situationship' } })).validate()
        ).rejects.toThrow(/relationship/);
    });
});

describe('AgentPersona — defaults', () => {
    it('has budget caps, cadence and active hours even when unspecified', async () => {
        const doc = new AgentPersona(validPersona());
        expect(doc.dailyBudget.llmCalls).toBeGreaterThan(0);
        expect(doc.dailyBudget.images).toBeGreaterThanOrEqual(0);
        expect(doc.dailyBudget.actions).toBeGreaterThan(0);
        expect(doc.cadence.postsPerWeek).toBeGreaterThan(0);
        expect(doc.activeHours.start).toBeGreaterThanOrEqual(0);
        expect(doc.activeHours.end).toBeLessThanOrEqual(23);
    });

    it("defaults to not open to romance — consent is opt-IN", async () => {
        const doc = new AgentPersona(validPersona());
        expect(doc.relationship.openToRomance).toBe(false);
        expect(doc.relationship.status).toBe('single');
    });

    it('is enabled by default (creating a persona is already deliberate)', async () => {
        expect(new AgentPersona(validPersona()).enabled).toBe(true);
    });

    it('does NOT auto-publish images by default — human review is opt-out, not opt-in', async () => {
        // §7: generated images land in the admin approval queue unless a human
        // has deliberately turned auto-publish on for this persona.
        expect(new AgentPersona(validPersona()).autoPublishImages).toBe(false);
    });

    it('accepts autoPublishImages: true when a human opts a persona in', async () => {
        const doc = new AgentPersona(validPersona({ autoPublishImages: true }));
        await expect(doc.validate()).resolves.toBeUndefined();
        const saved = await doc.save();
        expect(saved.autoPublishImages).toBe(true);
    });
});

describe('AgentPersona — one soul per account', () => {
    it('rejects a second persona for the same userId', async () => {
        const userId = new mongoose.Types.ObjectId();
        await new AgentPersona(validPersona({ userId })).save();
        await expect(
            new AgentPersona(validPersona({ userId, name: 'Impostor' })).save()
        ).rejects.toThrow(/duplicate key|E11000/);
    });

    it('allows personas for different userIds', async () => {
        await new AgentPersona(validPersona()).save();
        await expect(new AgentPersona(validPersona()).save()).resolves.toBeTruthy();
    });
});

// Phase F / F5 — the reference identity (§7).
//
// `visualIdentity` is what makes every generated photo the SAME synthetic
// person. It is optional (a persona is valid before its one-time reference run)
// but once present it has to hold both halves of the conditioning: the exact
// appearance text AND the reference portraits.
describe('AgentPersona — visualIdentity (F5, §7)', () => {
    it('is absent on a fresh persona — the face comes from a one-time run', async () => {
        const doc = new AgentPersona(validPersona());
        await expect(doc.validate()).resolves.toBeUndefined();
        expect(doc.visualIdentity?.referenceUrls ?? []).toHaveLength(0);
        expect(doc.visualIdentity?.appearance).toBeFalsy();
    });

    it('stores the appearance text and the reference portrait set', async () => {
        const doc = new AgentPersona(validPersona({
            visualIdentity: {
                appearance: 'early-30s woman, dark curly hair, freckles, warm olive skin',
                referenceUrls: ['https://res.cloudinary.com/a/1.jpg', 'https://res.cloudinary.com/a/2.jpg'],
                primaryUrl: 'https://res.cloudinary.com/a/1.jpg',
                generatedAt: new Date('2026-07-19T00:00:00Z'),
                model: 'gemini-3.1-flash-image',
            },
        }));

        await expect(doc.validate()).resolves.toBeUndefined();
        const saved = await doc.save();
        expect(saved.visualIdentity.appearance).toMatch(/dark curly hair/);
        expect(saved.visualIdentity.referenceUrls).toHaveLength(2);
        expect(saved.visualIdentity.primaryUrl).toBe('https://res.cloudinary.com/a/1.jpg');
        expect(saved.visualIdentity.model).toBe('gemini-3.1-flash-image');
    });

    it('accepts a full 5-portrait set (the §7 upper bound of 3–5 angles)', async () => {
        const urls = Array.from({ length: 5 }, (_, i) => `https://res.cloudinary.com/a/${i}.jpg`);
        const doc = new AgentPersona(validPersona({ visualIdentity: { referenceUrls: urls } }));
        await expect(doc.validate()).resolves.toBeUndefined();
    });

    it('rejects more than 5 portraits — past that the angles stop helping', async () => {
        const urls = Array.from({ length: 6 }, (_, i) => `https://res.cloudinary.com/a/${i}.jpg`);
        const doc = new AgentPersona(validPersona({ visualIdentity: { referenceUrls: urls } }));
        await expect(doc.validate()).rejects.toThrow(/at most 5 portraits/);
    });
});
