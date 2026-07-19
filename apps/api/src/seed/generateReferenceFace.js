// One-time reference-face generation for one agent persona (F5, §7).
//
//   GEMINI_API_KEY='...' node src/seed/generateReferenceFace.js maya.benari@agents.mirage42.ai
//
// §7: "per persona, generate one strong reference portrait set (one generation
// session, pick the best 3–5 angles/expressions of the same face). Store as the
// persona's visualIdentity (Cloudinary URLs + the exact appearance description
// text)."
//
// This is that session. It is a SCRIPT, not a route and not a per-post step: a
// persona's face is generated once and then reused forever. Re-running it makes
// a NEW face, which is why it refuses to overwrite an existing visualIdentity
// unless --force is passed.
//
// Every generated portrait goes to the SEPARATE agent Cloudinary account (§7).
// If that account is not configured the script stops before spending anything.
//
// Costs real money and calls a real API — which is exactly why it lives here,
// run deliberately by a human, rather than anywhere the worker could reach it.
require('dotenv').config();

const mongoose = require('mongoose');
const AgentPersona = require('../agents/models/AgentPersona');
const User = require('../users/models/User');
const { uploadAgentMedia, isAgentCloudinaryConfigured } = require('../utils/agentCloudinary');

// The prompt builders live with the runtime that normally uses them; reusing
// them here is the point — the reference face must be built by the same code
// that later asks for "the same person", or the two can drift apart.
const { buildReferencePrompt } = require('../../../agents/src/images/imagePrompt');
const { generateImage } = require('../../../agents/src/images/gemini');
const { readImageConfig } = require('../../../agents/src/config');

/**
 * The angles §7 asks for: the SAME face from a few views, so later generations
 * have more than one anchor. Kept small — 4 images is one cheap session.
 */
const ANGLES = [
    'straight-on, neutral expression, looking at the camera',
    'three-quarter view from her left, faint smile',
    'straight-on, laughing, eyes slightly crinkled',
    'profile view from her right, relaxed',
];

/**
 * Maya's appearance. Written once, stored on the persona, and then repeated
 * verbatim in every later generation. Deliberately specific about the things
 * that make a face recognisable and silent about clothing and setting, which
 * change per photo.
 *
 * Consistent with the seeded persona: 31, Israeli, a designer who runs on the
 * beach most mornings.
 */
const DEFAULT_APPEARANCE = [
    'A woman in her early thirties with a Mediterranean, Israeli appearance.',
    'Dark brown curly shoulder-length hair, usually loosely tied back.',
    'Warm olive skin with light freckles across the nose and cheeks.',
    'Dark brown eyes, thick natural eyebrows, a small mole below her left eye.',
    'A narrow face with high cheekbones and a slightly crooked front tooth when she smiles.',
    'Slim build, average height. No make-up or very little. No glasses.',
    'Small gold stud earrings and a thin chain necklace she always wears.',
].join(' ');

const log = (...args) => console.log('[reference-face]', ...args);

/**
 * Whether a persona already has a face that re-running would destroy.
 *
 * Pulled out as a plain predicate because it is the single most damaging thing
 * this script can get wrong: a second run makes a DIFFERENT person, and every
 * photo the persona has already posted then belongs to a stranger.
 */
const hasExistingFace = (persona) => Boolean(persona?.visualIdentity?.referenceUrls?.length);

/**
 * Generates and uploads the portrait set. Separated from main() so it is
 * testable without a database, a network, or a Cloudinary account.
 *
 * One failed angle does not discard the angles already paid for — it is skipped
 * and the run continues. Only a total failure throws.
 */
const generateReferenceSet = async ({
    appearance,
    imageConfig,
    angles = ANGLES,
    generateImpl = generateImage,
    uploadImpl = uploadAgentMedia,
    logger = { log },
} = {}) => {
    const urls = [];
    const failures = [];

    for (const [index, angle] of angles.entries()) {
        const prompt = buildReferencePrompt({ appearance, angle });
        logger.log(`  [${index + 1}/${angles.length}] ${angle}`);

        let image;
        try {
            image = await generateImpl({
                apiKey: imageConfig.apiKey,
                model: imageConfig.model,
                prompt,
            });
        } catch (err) {
            logger.log(`  ! angle ${index + 1} failed (${err.message}) — continuing`);
            failures.push(err.message);
            continue;
        }

        const url = await uploadImpl(Buffer.from(image.base64, 'base64'), 'reference');
        urls.push(url);
        logger.log(`  -> ${url}`);
    }

    if (!urls.length) {
        // The old message was "every angle failed — nothing to store", which
        // told the operator nothing about WHY and sent them back to the logs.
        // If every angle died the same way — which is what a wrong model or a
        // bad key looks like — say so once, in Google's words.
        const unique = [...new Set(failures)];
        const because = unique.length === 1
            ? `every angle failed with the same error: ${unique[0]}`
            : `every angle failed:\n  - ${unique.join('\n  - ')}`;
        throw new Error(
            `${because}\n\nRun the diagnostic to see what this key can actually reach:\n` +
            `  cd apps/agents && GEMINI_API_KEY='...' node src/images/diagnoseImageApi.js`
        );
    }

    return {
        appearance,
        referenceUrls: urls,
        primaryUrl: urls[0],
        generatedAt: new Date(),
        model: imageConfig.model,
    };
};

const main = async () => {
    const email = process.argv[2];
    const force = process.argv.includes('--force');

    if (!email) {
        console.error('Usage: node src/seed/generateReferenceFace.js <agent-email> [--force]');
        process.exit(1);
    }

    const imageConfig = readImageConfig(process.env);
    if (!imageConfig.hasKey) {
        console.error('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set. Nothing to do.');
        process.exit(1);
    }
    // Checked BEFORE any generation: paying for images with nowhere to put them
    // would be a pure waste, and the live account is not an option (§7).
    if (!isAgentCloudinaryConfigured()) {
        console.error(
            'Agent Cloudinary is not configured (AGENT_CLOUDINARY_CLOUD_NAME / _API_KEY / ' +
            '_API_SECRET). Refusing to generate — agent media must never go to the live account.'
        );
        process.exit(1);
    }

    await mongoose.connect(process.env.DB_CONNECTION_STRING);
    log('connected to mongoDB');

    try {
        const user = await User.findOne({ email }).lean();
        if (!user) throw new Error(`no user with email ${email}`);

        const persona = await AgentPersona.findOne({ userId: user._id });
        if (!persona) throw new Error(`no persona for ${email} — run seedAgentPersona.js first`);

        if (hasExistingFace(persona) && !force) {
            log(`${persona.name} already has a reference face (${persona.visualIdentity.referenceUrls.length} portraits).`);
            log('Re-running generates a DIFFERENT face and breaks consistency with every existing photo.');
            log('Pass --force if that is genuinely what you want.');
            return;
        }

        const appearance = process.env.AGENT_APPEARANCE?.trim() || DEFAULT_APPEARANCE;
        log(`generating ${ANGLES.length} portraits for ${persona.name} with ${imageConfig.model}`);
        log(`appearance: ${appearance}`);

        const visualIdentity = await generateReferenceSet({ appearance, imageConfig });
        persona.visualIdentity = visualIdentity;
        await persona.save();

        log(`stored visualIdentity on ${persona.name}: ${visualIdentity.referenceUrls.length} portraits, primary ${visualIdentity.primaryUrl}`);
        log('REVIEW THESE BEFORE USING THEM — everything this persona ever posts will look like this person.');
    } finally {
        await mongoose.disconnect();
        log('disconnected from mongoDB');
    }
};

if (require.main === module) {
    main().catch((err) => {
        console.error('[reference-face] failed:', err.message);
        process.exit(1);
    });
}

module.exports = {
    main, generateReferenceSet, hasExistingFace, ANGLES, DEFAULT_APPEARANCE,
};
