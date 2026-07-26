const cloudinary = require('cloudinary').v2;
const { readAgentCloudinaryConfig } = require('../../utils/agentCloudinary');

/**
 * Automated content moderation for agent-generated images (§7).
 *
 * WHY THIS EXISTS: until now the ONLY thing standing between a generated image
 * and the public feed was a human in the review queue. The moment we let an
 * agent auto-publish, that human is gone — so an automated gate has to take the
 * post. This module is that gate.
 *
 * It runs on Cloudinary, because agent media already lives there: the image is
 * uploaded, then this asks Cloudinary's moderation add-on for a verdict on it
 * (via the `explicit` API, which re-analyses an already-uploaded asset without a
 * second upload). The add-on is selectable with AGENT_IMAGE_MODERATION_ADDON.
 *
 * IT FAILS CLOSED. Every path that is not an explicit "approved" returns
 * ok:false — no credentials, no derivable public id, a provider error, a
 * "rejected" verdict, or an inconclusive/pending one. The caller treats ok:false
 * as "do NOT auto-publish; leave it for a human". The safe default when we
 * cannot be sure an image is fine is to not publish it.
 *
 * The Cloudinary client is injectable (`moderator`) so tests never touch the
 * network. Nothing in this module has been run against a live Cloudinary
 * moderation add-on — see docs/decisions.md.
 */

const DEFAULT_ADDON = 'aws_rek';

/**
 * Pulls the Cloudinary public_id (folder included) out of a secure URL.
 *
 * Our agent uploads carry no transformations, so the shape is stable:
 *   https://res.cloudinary.com/<cloud>/image/upload/[v<digits>/]<folder>/<name>.<ext>
 * Returns null when it cannot parse — which, because we fail closed, simply
 * holds the image for human review rather than publishing something unchecked.
 */
const publicIdFromUrl = (url) => {
    const marker = '/upload/';
    const raw = String(url || '');
    const idx = raw.indexOf(marker);
    if (idx === -1) return null;

    let rest = raw.slice(idx + marker.length);
    rest = rest.split('?')[0].split('#')[0]; // strip any query/fragment
    rest = rest.replace(/^v\d+\//, '');       // strip a leading version segment
    rest = rest.replace(/\.[^/.]+$/, '');     // strip the file extension
    return rest || null;
};

/**
 * @returns {Promise<{ ok: boolean, status: string, reason?: string, provider: string }>}
 */
const moderateImage = async ({ imageUrl, env = process.env, moderator, addon } = {}) => {
    const chosenAddon = (addon || (env.AGENT_IMAGE_MODERATION_ADDON || '').trim() || DEFAULT_ADDON);
    const provider = `cloudinary:${chosenAddon}`;

    const config = readAgentCloudinaryConfig(env);
    if (!config) {
        return { ok: false, status: 'unavailable', reason: 'agent-cloudinary-not-configured', provider };
    }

    const publicId = publicIdFromUrl(imageUrl);
    if (!publicId) {
        return { ok: false, status: 'unavailable', reason: 'could-not-derive-public-id', provider };
    }

    const api = moderator || cloudinary.uploader;
    let result;
    try {
        result = await api.explicit(publicId, { ...config, type: 'upload', moderation: chosenAddon });
    } catch (err) {
        // Any provider error — add-on not enabled, network, auth — fails closed.
        return { ok: false, status: 'unavailable', reason: `moderation-call-failed: ${err.message}`, provider };
    }

    const entry = Array.isArray(result?.moderation) ? result.moderation[0] : null;
    const status = entry?.status;

    if (status === 'approved') return { ok: true, status: 'approved', provider };
    if (status === 'rejected') return { ok: false, status: 'rejected', reason: 'flagged-by-moderation', provider };

    // 'pending' (asynchronous add-ons) or anything unrecognised: we do not have a
    // clean pass, so we do not publish.
    return { ok: false, status: status || 'unavailable', reason: 'moderation-inconclusive', provider };
};

module.exports = { moderateImage, publicIdFromUrl, DEFAULT_ADDON };
