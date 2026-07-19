// Agent media uploads (F5, §7).
//
// §7 is unambiguous: "All agent media goes to the separate mirage42ai Cloudinary
// account (to be created — Phase B), never the live mirage42 one."
//
// So this file does NOT reuse utils/cloudinary.js. That module calls
// cloudinary.config() at import time, which sets GLOBAL SDK credentials — the
// live mirage42 account that human uploads depend on. Re-configuring it for
// agent uploads would silently repoint every human upload too. Instead the
// agent credentials are passed PER CALL, which the SDK supports, leaving the
// global config (and every human upload path) untouched.
//
// If the agent account is not configured, this throws rather than falling back.
// A fallback would put synthetic media in the live account, which is the one
// outcome §7 rules out — and the caller is expected to treat the throw as
// "skip the image", not as a crash.
const cloudinary = require('cloudinary').v2;

const AGENT_FOLDER = 'agents';

/** Reads the separate agent account's credentials. Returns null when unset. */
const readAgentCloudinaryConfig = (env = process.env) => {
    const cloudName = (env.AGENT_CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = (env.AGENT_CLOUDINARY_API_KEY || '').trim();
    const apiSecret = (env.AGENT_CLOUDINARY_API_SECRET || '').trim();

    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
};

const isAgentCloudinaryConfigured = (env = process.env) => readAgentCloudinaryConfig(env) !== null;

/**
 * Uploads one agent-generated image to the SEPARATE agent account.
 *
 * @param {Buffer} fileBuffer
 * @param {string} subfolder   e.g. 'reference' or 'pending'
 * @returns {Promise<string>}  the secure URL
 */
const uploadAgentMedia = (fileBuffer, subfolder = 'pending', { env = process.env, uploader } = {}) => {
    const config = readAgentCloudinaryConfig(env);
    if (!config) {
        throw new Error(
            'Agent Cloudinary account is not configured (AGENT_CLOUDINARY_CLOUD_NAME / ' +
            '_API_KEY / _API_SECRET). Refusing to upload agent media to the live account.'
        );
    }

    // Injectable for tests — the suite must never reach Cloudinary.
    const upload = uploader || cloudinary.uploader;

    return new Promise((resolve, reject) => {
        upload.upload_stream(
            {
                ...config,                       // per-call creds; global config untouched
                folder: `${AGENT_FOLDER}/${subfolder}`,
                resource_type: 'image',          // agents post images, never video
            },
            (error, result) => (error ? reject(error) : resolve(result.secure_url))
        ).end(fileBuffer);
    });
};

module.exports = {
    uploadAgentMedia,
    isAgentCloudinaryConfigured,
    readAgentCloudinaryConfig,
    AGENT_FOLDER,
};
