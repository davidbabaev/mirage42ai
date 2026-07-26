// Phase F / F5 — agent media goes to the SEPARATE Cloudinary account (§7).
//
// "All agent media goes to the separate mirage42ai Cloudinary account ... never
// the live mirage42 one." The failure this guards against is quiet and bad:
// synthetic photos accumulating in the real account because the agent creds
// were missing and something helpfully fell back.
//
// Cloudinary is never contacted — the uploader is injected.
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-client-secret';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.SERVER_URL ||= 'http://localhost:8181';
process.env.CLIENT_URL ||= 'http://localhost:5173';

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const {
    uploadAgentMedia, isAgentCloudinaryConfigured, readAgentCloudinaryConfig,
} = requireFromHere('../src/utils/agentCloudinary');

const AGENT_ENV = {
    AGENT_CLOUDINARY_CLOUD_NAME: 'mirage42ai-agents',
    AGENT_CLOUDINARY_API_KEY: 'agent-key',
    AGENT_CLOUDINARY_API_SECRET: 'agent-secret',
};

/** A fake upload_stream that records the options it was called with. */
const fakeUploader = () => {
    const calls = [];
    return {
        calls,
        upload_stream: (options, cb) => {
            calls.push(options);
            return { end: () => cb(null, { secure_url: 'https://res.cloudinary.com/agents/x.jpg' }) };
        },
    };
};

describe('agent Cloudinary — configuration', () => {
    it('reports unconfigured when the agent vars are absent', () => {
        expect(isAgentCloudinaryConfigured({})).toBe(false);
        expect(readAgentCloudinaryConfig({})).toBeNull();
    });

    it('requires ALL THREE vars — a partial config is not configured', () => {
        expect(isAgentCloudinaryConfigured({ AGENT_CLOUDINARY_CLOUD_NAME: 'x' })).toBe(false);
        expect(isAgentCloudinaryConfigured({
            AGENT_CLOUDINARY_CLOUD_NAME: 'x', AGENT_CLOUDINARY_API_KEY: 'y',
        })).toBe(false);
        expect(isAgentCloudinaryConfigured(AGENT_ENV)).toBe(true);
    });

    it('does NOT treat the live mirage42 credentials as the agent account', () => {
        // The live vars being present must not make agent uploads look ready.
        expect(isAgentCloudinaryConfigured({
            CLOUDINARY_CLOUD_NAME: 'mirage42-live',
            CLOUDINARY_API_KEY: 'live-key',
            CLOUDINARY_API_SECRET: 'live-secret',
        })).toBe(false);
    });
});

describe('agent Cloudinary — uploads', () => {
    it('refuses to upload when the agent account is unconfigured', () => {
        const uploader = fakeUploader();
        expect(() => uploadAgentMedia(Buffer.from('x'), 'pending', { env: {}, uploader }))
            .toThrow(/Refusing to upload agent media to the live account/);
        expect(uploader.calls).toHaveLength(0);
    });

    it('sends the AGENT credentials per call, not the live ones', async () => {
        const uploader = fakeUploader();
        await uploadAgentMedia(Buffer.from('img'), 'pending', {
            env: { ...AGENT_ENV, CLOUDINARY_CLOUD_NAME: 'mirage42-live', CLOUDINARY_API_KEY: 'live-key' },
            uploader,
        });

        expect(uploader.calls[0]).toMatchObject({
            cloud_name: 'mirage42ai-agents',
            api_key: 'agent-key',
            api_secret: 'agent-secret',
        });
        // The live account must not appear anywhere in the upload options.
        expect(JSON.stringify(uploader.calls[0])).not.toContain('mirage42-live');
        expect(JSON.stringify(uploader.calls[0])).not.toContain('live-key');
    });

    it('files uploads under an agents/ folder, separated by purpose', async () => {
        const uploader = fakeUploader();
        await uploadAgentMedia(Buffer.from('img'), 'reference', { env: AGENT_ENV, uploader });
        expect(uploader.calls[0].folder).toBe('agents/reference');

        await uploadAgentMedia(Buffer.from('img'), 'pending', { env: AGENT_ENV, uploader });
        expect(uploader.calls[1].folder).toBe('agents/pending');
    });

    it('restricts agent uploads to images — agents do not post video', async () => {
        const uploader = fakeUploader();
        await uploadAgentMedia(Buffer.from('img'), 'pending', { env: AGENT_ENV, uploader });
        expect(uploader.calls[0].resource_type).toBe('image');
    });

    it('resolves to the secure url', async () => {
        const uploader = fakeUploader();
        await expect(uploadAgentMedia(Buffer.from('img'), 'pending', { env: AGENT_ENV, uploader }))
            .resolves.toBe('https://res.cloudinary.com/agents/x.jpg');
    });

    it('propagates an upload failure rather than returning a broken url', async () => {
        const uploader = {
            upload_stream: (_o, cb) => ({ end: () => cb(new Error('cloudinary exploded')) }),
        };
        await expect(uploadAgentMedia(Buffer.from('img'), 'pending', { env: AGENT_ENV, uploader }))
            .rejects.toThrow(/cloudinary exploded/);
    });

    it('never mutates the global SDK config (which human uploads depend on)', async () => {
        const cloudinary = requireFromHere('cloudinary').v2;
        const before = { ...cloudinary.config() };
        const uploader = fakeUploader();

        await uploadAgentMedia(Buffer.from('img'), 'pending', { env: AGENT_ENV, uploader });

        const after = cloudinary.config();
        expect(after.cloud_name).toBe(before.cloud_name);
        expect(after.api_key).toBe(before.api_key);
        expect(vi.isMockFunction(after.upload_stream)).toBe(false);
    });
});
