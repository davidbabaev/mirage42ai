// Phase F / F5 follow-up — automated moderation for auto-published images (§7).
//
// Once an agent can auto-publish, the human in the review queue is gone and this
// is the only gate left. So the behaviour that MUST hold is that it FAILS
// CLOSED: anything short of an explicit "approved" — no add-on, a provider
// error, an unparseable url, a "pending" or missing verdict — returns ok:false,
// which the caller reads as "do not publish; leave it for a human".
//
// Cloudinary is never contacted — the moderator client is injected.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { moderateImage, publicIdFromUrl } = requireFromHere('../src/agents/service/agentImageModeration');

const AGENT_ENV = {
    AGENT_CLOUDINARY_CLOUD_NAME: 'mirage42ai-agents',
    AGENT_CLOUDINARY_API_KEY: 'agent-key',
    AGENT_CLOUDINARY_API_SECRET: 'agent-secret',
};

const URL = 'https://res.cloudinary.com/mirage42ai-agents/image/upload/v1710000000/agents/pending/abc123.png';

/** A fake Cloudinary uploader whose explicit() returns a canned moderation array. */
const mockModerator = (status, { throws } = {}) => ({
    explicit: vi.fn(async () => {
        if (throws) throw new Error(throws);
        return { moderation: status ? [{ kind: 'aws_rek', status }] : [] };
    }),
});

describe('publicIdFromUrl — derives the Cloudinary id from our upload URLs', () => {
    it('strips host, /upload/, version and extension, keeping the folder', () => {
        expect(publicIdFromUrl(URL)).toBe('agents/pending/abc123');
    });

    it('handles a URL with no version segment', () => {
        expect(publicIdFromUrl('https://res.cloudinary.com/c/image/upload/agents/pending/x.jpg'))
            .toBe('agents/pending/x');
    });

    it('ignores a query string', () => {
        expect(publicIdFromUrl(URL + '?_a=cache')).toBe('agents/pending/abc123');
    });

    it('returns null for something that is not a Cloudinary upload url', () => {
        expect(publicIdFromUrl('https://example.com/whatever.png')).toBeNull();
        expect(publicIdFromUrl('')).toBeNull();
    });
});

describe('moderateImage — passes only on an explicit approval', () => {
    it('returns ok on an "approved" verdict', async () => {
        const moderator = mockModerator('approved');
        const verdict = await moderateImage({ imageUrl: URL, env: AGENT_ENV, moderator });

        expect(verdict).toMatchObject({ ok: true, status: 'approved' });
        // It moderated the RIGHT asset, with the agent creds and the add-on.
        expect(moderator.explicit).toHaveBeenCalledWith('agents/pending/abc123', expect.objectContaining({
            type: 'upload', moderation: 'aws_rek', cloud_name: 'mirage42ai-agents', api_key: 'agent-key',
        }));
    });

    it('honours a per-env add-on choice', async () => {
        const moderator = mockModerator('approved');
        await moderateImage({
            imageUrl: URL,
            env: { ...AGENT_ENV, AGENT_IMAGE_MODERATION_ADDON: 'perception_point' },
            moderator,
        });
        expect(moderator.explicit.mock.calls[0][1].moderation).toBe('perception_point');
    });
});

describe('moderateImage — FAILS CLOSED on everything else', () => {
    it('holds when the verdict is "rejected"', async () => {
        const verdict = await moderateImage({ imageUrl: URL, env: AGENT_ENV, moderator: mockModerator('rejected') });
        expect(verdict).toMatchObject({ ok: false, status: 'rejected' });
    });

    it('holds when the add-on is asynchronous and still "pending"', async () => {
        const verdict = await moderateImage({ imageUrl: URL, env: AGENT_ENV, moderator: mockModerator('pending') });
        expect(verdict.ok).toBe(false);
    });

    it('holds when the moderation response is empty/unrecognised', async () => {
        const verdict = await moderateImage({ imageUrl: URL, env: AGENT_ENV, moderator: mockModerator(null) });
        expect(verdict.ok).toBe(false);
    });

    it('holds when the provider throws (add-on not enabled, network, auth)', async () => {
        const verdict = await moderateImage({
            imageUrl: URL, env: AGENT_ENV, moderator: mockModerator('approved', { throws: 'add-on not enabled' }),
        });
        expect(verdict).toMatchObject({ ok: false, status: 'unavailable' });
        expect(verdict.reason).toMatch(/moderation-call-failed/);
    });

    it('holds — and never calls the provider — when the agent account is unconfigured', async () => {
        const moderator = mockModerator('approved');
        const verdict = await moderateImage({ imageUrl: URL, env: {}, moderator });
        expect(verdict).toMatchObject({ ok: false, reason: 'agent-cloudinary-not-configured' });
        expect(moderator.explicit).not.toHaveBeenCalled();
    });

    it('holds when the url cannot be parsed into a public id', async () => {
        const moderator = mockModerator('approved');
        const verdict = await moderateImage({ imageUrl: 'not-a-cloudinary-url', env: AGENT_ENV, moderator });
        expect(verdict).toMatchObject({ ok: false, reason: 'could-not-derive-public-id' });
        expect(moderator.explicit).not.toHaveBeenCalled();
    });
});
