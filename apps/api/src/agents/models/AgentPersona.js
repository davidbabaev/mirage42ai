const mongoose = require('mongoose');

/**
 * An agent's soul (master-plan §5, §6).
 *
 * One document per agent account. The persona compiles into the system prompt
 * for every LLM call that agent makes — so these fields are not decoration,
 * they ARE the behaviour: values and voice decide how it writes, the
 * relationship rules decide how it responds to advances, active hours decide
 * when it is awake, and the budgets are the cost ceiling.
 *
 * Kept in its own collection rather than nested on User because it is agent-only
 * data with a very different shape and lifecycle, and because User is on every
 * hot read path in the app — nobody should pay to load a backstory.
 *
 * NOT here yet: `visualIdentity` (reference portrait set + appearance text).
 * That arrives with the image pipeline in F5 (§7).
 *
 * NEVER exposed on any public API response. Persona text is the illusion's
 * backstage; leaking it would out the account as an agent just as surely as
 * `User.kind` would.
 */

// 0–23, interpreted in the persona's OWN timezone. An agent posting at 4am
// local time is one of the loudest "this is a bot" signals there is (§6).
const HOUR = {
    type: Number,
    min: 0,
    max: 23,
};

const AgentPersonaSchema = new mongoose.Schema({
    // The user account this persona drives. Unique: one soul per account.
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },

    // ---- Identity -----------------------------------------------------
    // Mirrors the User's display name. Denormalized on purpose: prompt
    // compilation happens on every LLM call and should not need a join.
    name: {
        type: String,
        required: true,
        maxLength: 256,
        trim: true,
    },
    // 18+ is a safety rail, not a formatting rule: the product is intended 18+
    // and an agent must never present as a minor (§6, safety rails).
    age: {
        type: Number,
        required: true,
        min: 18,
        max: 120,
    },
    // BCP-47-ish, e.g. 'en-US'. Drives language and idiom in the prompt.
    locale: {
        type: String,
        required: true,
        maxLength: 35,
        trim: true,
    },
    // IANA zone, e.g. 'Asia/Jerusalem'. Everything time-of-day is resolved
    // against this, never against the server's clock.
    timezone: {
        type: String,
        required: true,
        maxLength: 64,
        trim: true,
    },
    occupation: {
        type: String,
        maxLength: 128,
        trim: true,
    },

    // ---- Soul ---------------------------------------------------------
    // What this person cares about. Short phrases, not prose — they are
    // injected as bullets into the system prompt.
    values: {
        type: [String],
        default: [],
    },
    // How they SOUND: sentence length, formality, humour, emoji habits,
    // whether they typo. Free prose, read verbatim into the prompt.
    voice: {
        type: String,
        maxLength: 2048,
    },
    // Where they came from and what is going on in their life right now.
    backstory: {
        type: String,
        maxLength: 4096,
    },
    // Load-bearing, not flavour (§6): these decide whether an advance in a DM
    // is warmly reciprocated or politely declined. The married persona
    // declining is the plan's own headline test case.
    relationship: {
        status: {
            type: String,
            enum: ['single', 'dating', 'married', 'complicated'],
            default: 'single',
        },
        // Whether this persona entertains romantic conversation at all.
        openToRomance: {
            type: Boolean,
            default: false,
        },
    },

    // ---- Rhythm (the "alive" illusion) --------------------------------
    // Target volume, not a quota: the decision loop should choose "do nothing"
    // most ticks (§6). This is the upper shape of a normal week.
    cadence: {
        postsPerWeek: { type: Number, min: 0, max: 100, default: 3 },
        commentsPerDay: { type: Number, min: 0, max: 100, default: 4 },
    },
    // The waking window. Outside it the scheduler must not tick this agent.
    activeHours: {
        start: { ...HOUR, default: 8 },
        end: { ...HOUR, default: 23 },
    },

    // ---- Cost ceiling (non-negotiable, §6 safety rails) ----------------
    // "Cost discipline lives in code, not in intentions" (§11). The runtime
    // enforces these per UTC day and stops; they are not advisory.
    dailyBudget: {
        llmCalls: { type: Number, min: 0, default: 40 },
        images: { type: Number, min: 0, default: 1 },
        actions: { type: Number, min: 0, default: 20 },
    },

    // Per-agent pause, independent of the global AGENTS_ENABLED kill-switch.
    // Lets one misbehaving agent be silenced without stopping the others.
    enabled: {
        type: Boolean,
        default: true,
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// One persona per account, and the runtime looks personas up BY user id every
// time it acts. Unique doubles as the integrity guarantee and the index.
AgentPersonaSchema.index({ userId: 1 }, { unique: true });

// The scheduler's roster query: every persona not individually paused.
AgentPersonaSchema.index({ enabled: 1 });

// activeHours may legitimately wrap midnight (a night owl: 22 -> 2), so a
// start/end ordering rule would be wrong. Both ends being real hours is
// enforced by the field min/max above; the WRAP is handled by the scheduler.
const AgentPersona = mongoose.model('AgentPersona', AgentPersonaSchema);
module.exports = AgentPersona;
