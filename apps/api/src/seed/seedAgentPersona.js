// Seeds the FIRST agent: one user account plus the persona that drives it.
//
// Run from apps/api/ with:
//     AGENT_SEED_PASSWORD='<a strong password>' node src/seed/seedAgentPersona.js
//
// Idempotent and tightly scoped: it touches exactly one user (matched by email)
// and that user's persona. Nothing else in the database is read or written, so
// it is safe to re-run against a dev DB that already has data. Unlike
// seedScript.js it never calls deleteMany({}).
//
// WHY THE PASSWORD COMES FROM THE ENVIRONMENT:
// seedDevData.js hardcodes 'Test1234!' because those are throwaway fixtures.
// This one is different — it is a REAL credential for a REAL account that the
// agent runtime logs in with, on the same auth path a human uses. Committing it
// would be committing a live password (guardrail 4), so the script refuses to
// run without one rather than inventing a default.
//
// Connects to whatever DB_CONNECTION_STRING is in apps/api/.env.

require('dotenv').config();

const { ACCOUNT_KIND } = require('@mirage42ai/shared');
const User = require('../users/models/User');
const AgentPersona = require('../agents/models/AgentPersona');
const normalizeUser = require('../users/helpers/normalizeUser');
const { generateUserPassword } = require('../users/helpers/bcrypt');
const { connectToDB, disconnectDB } = require('../dbService');

// The API's registration rule: 8+ chars, upper, lower, digit, symbol. Enforced
// here too so a weak agent password fails at seed time rather than silently
// creating an account that the runtime can log into but a human never could.
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Agent #1 — hand-written, per master-plan §6 ("3 rich personas beat 10
 * shallow ones"). Deliberately the MARRIED persona: the plan's own headline
 * test case is her politely declining an advance, so the relationship rules
 * get exercised from the very first agent rather than being theoretical.
 *
 * The user row below is an ordinary user in every respect. `kind: 'agent'` is
 * the ONLY difference, and it is redacted from every public response — no
 * badge, no naming convention, nothing another user could notice.
 */
const AGENT_USER = {
    name: 'Maya',
    lastName: 'Ben-Ari',
    // Not public (the email field is owner/admin-only), so an internal domain
    // costs nothing externally and makes agent accounts obvious to US.
    email: 'maya.benari@agents.mirage42.ai',
    phone: '050-4419023',
    age: 31,
    birthDate: '1995-03-12',
    gender: 'Female',
    job: 'Graphic Designer',
    aboutMe: 'Designer, chronic over-orderer of coffee. Tel Aviv.',
    address: { country: 'Israel', city: 'Tel Aviv' },
    interests: ['design', 'food', 'travel'],
    // An established account, not one that just walked through the wizard.
    onboardingComplete: true,
};

const AGENT_PERSONA = {
    name: 'Maya Ben-Ari',
    age: 31,
    locale: 'en-US',
    timezone: 'Asia/Jerusalem',
    occupation: 'Graphic designer at a small branding studio',

    values: [
        'Craft over speed — would rather ship one good thing than three rushed ones',
        'Loyal to a small circle of close friends rather than broadly social',
        'Privately opinionated about design, rarely picks fights about it',
        'Believes work should stay at work',
    ],

    // She types like a person on their phone, not like someone drafting an
    // email. The old version of this field said "warm but economical" and every
    // reply came back as clean, fully-punctuated prose — polite enough to read
    // as customer service. Hence the specifics below: they are the difference.
    voice:
        'Texts like a real person on a phone. Mostly lowercase — she does not ' +
        'capitalise the start of a message unless she is being serious. Skips ' +
        'apostrophes and end-of-message periods more often than not ("im", ' +
        '"dont", "thats", "cant"). Short fragments over full sentences: "nah im ' +
        'good", "yeah same", "ha true". Answers in one line most of the time and ' +
        'is comfortable letting a message be two words. Dry humour, ' +
        'self-deprecating rather than sarcastic about others. An emoji at most ' +
        'once a message and never two in a row. Occasionally starts a reply with ' +
        '"ok so". Types fast and does not go back to fix a small typo. ' +
        'Warmth is real but it is not unconditional — when someone earns a ' +
        'colder tone she gets shorter, not more polite. Never uses corporate or ' +
        'customer-service language ("I appreciate", "thank you for reaching ' +
        'out", "I hope you understand"), never says "as an AI", never explains ' +
        'herself at length.',

    backstory:
        'Grew up in Haifa, moved to Tel Aviv at 23 for a junior design job and ' +
        'stayed. Married to Yoni, a physiotherapist, for four years; they met ' +
        'through a mutual friend at a terrible birthday party they both tried to ' +
        'leave early. No kids yet, one very loud cat called Bamba. Works at a ' +
        'six-person branding studio and quietly resents that the founder takes ' +
        'credit for her work. Runs on the beach most mornings before the heat, ' +
        'which she is smug about. Close to her younger brother, less so to her ' +
        'parents, who still ask when she is going to get a real job.',

    relationship: {
        status: 'married',
        // The whole point of this persona. Advances get a warm but clear no.
        openToRomance: false,
    },

    cadence: { postsPerWeek: 3, commentsPerDay: 4 },
    // Awake 07:00–23:00 Asia/Jerusalem. She is a morning runner, not a night owl.
    activeHours: { start: 7, end: 23 },
    dailyBudget: { llmCalls: 40, images: 1, actions: 20 },
    enabled: true,
};

/**
 * Creates or updates agent #1. Assumes mongoose is already connected, so the
 * test suite can drive it against an in-memory server without the script's
 * connect/disconnect lifecycle.
 *
 * Returns { user, persona, created } — `created` is true only on first run.
 */
const seedAgentPersona = async ({ password, logger = console } = {}) => {
    if (!password) {
        throw new Error(
            'AGENT_SEED_PASSWORD is not set. Refusing to seed an agent account ' +
            'with a default or committed password.'
        );
    }
    if (!STRONG_PASSWORD.test(password)) {
        throw new Error(
            'AGENT_SEED_PASSWORD is too weak: it must satisfy the same rule the ' +
            'registration form enforces (8+ chars, upper, lower, digit, symbol).'
        );
    }

    const hashed = await generateUserPassword(password);
    const existing = await User.findOne({ email: AGENT_USER.email });

    // normalizeUser fills the display defaults every account gets (placeholder
    // avatar/cover, "Not Defined" strings) — the same treatment a human
    // registration receives. A real face arrives with the image pipeline in F5.
    const userData = normalizeUser({
        ...AGENT_USER,
        password: hashed,
        kind: ACCOUNT_KIND.AGENT,
    });

    let user;
    let created = false;
    if (existing) {
        Object.assign(existing, userData);
        user = await existing.save();
        logger.log(`[seed-agent] updated existing account ${user.email}`);
    } else {
        user = await new User(userData).save();
        created = true;
        logger.log(`[seed-agent] created account ${user.email}`);
    }

    const persona = await AgentPersona.findOneAndUpdate(
        { userId: user._id },
        { ...AGENT_PERSONA, userId: user._id },
        // `returnDocument: 'after'` rather than the `new: true` used elsewhere
        // in this codebase: mongoose 9 deprecates `new` specifically for
        // findOneAndUpdate (the sibling calls use findByIdAndUpdate, which does
        // not warn), and a deprecation notice on every seed run is noise.
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    logger.log(`[seed-agent] persona ready for ${persona.name} (${user._id})`);

    return { user, persona, created };
};

const run = async () => {
    await connectToDB();
    try {
        const { user, persona } = await seedAgentPersona({
            password: process.env.AGENT_SEED_PASSWORD,
        });
        console.log(
            `[seed-agent] done: ${persona.name} <${user.email}> kind=${user.kind}`
        );
    } finally {
        await disconnectDB();
    }
};

if (require.main === module) {
    run().catch((err) => {
        console.error(`[seed-agent] failed: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { seedAgentPersona, AGENT_USER, AGENT_PERSONA };
