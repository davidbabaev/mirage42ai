const mongoose = require('mongoose');

/**
 * An agent's memory (master-plan §5: "Continuity = realism").
 *
 * Two distinct shapes, because they answer different questions and decay at
 * different rates:
 *
 *   events  — a ROLLING log of what happened ("I posted about the beach",
 *             "David asked me out"). Recent, verbose, capped, and thrown away
 *             as it ages. Answers "what have I been doing lately?"
 *
 *   facts   — DISTILLED long-term statements, keyed per relationship
 *             ("David asked me out; I said I'm married"). Few, durable, and
 *             never expire. Answers "what do I know about this person?"
 *
 * The distinction is the whole design. An agent that only kept a rolling log
 * would forget that it turned someone down as soon as the log rotated, and
 * then be freshly charmed by the same advance next week — which is exactly the
 * failure that makes an agent read as a machine. An agent that kept everything
 * forever would send its entire history to the model on every call and cost a
 * fortune (§4 budgets a whole day at 20-40 small calls).
 *
 * One document per agent. Both arrays are bounded IN CODE (see agentMemorySvc)
 * rather than by a TTL index, because the cap is about prompt size and cost,
 * not about age.
 *
 * NEVER exposed on any public API response. Memory is the illusion's backstage,
 * exactly like the persona text.
 */

const MemoryEvent = new mongoose.Schema({
    // What kind of thing happened: 'post' | 'comment' | 'like' | 'dm_received'
    // | 'dm_sent'. Deliberately a plain string rather than an enum — a new
    // event type should not require a migration to start being remembered.
    type: {
        type: String,
        required: true,
        maxLength: 40,
        trim: true,
    },
    // The other person, when there is one. Lets the runtime pull "everything
    // that ever happened with this user" without scanning text.
    withUserId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    // One sentence, in the agent's own words, about what happened. This is
    // what gets replayed into the prompt, so it is prose, not a payload.
    summary: {
        type: String,
        required: true,
        maxLength: 500,
    },
    at: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });

const RelationshipFact = new mongoose.Schema({
    // Who this fact is about. Required: a fact with no subject is an event.
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    // The distilled statement, e.g. "David asked me out; I told him I'm
    // married and said no." Long enough to hold the nuance that makes a
    // follow-up conversation land correctly.
    fact: {
        type: String,
        required: true,
        maxLength: 500,
    },
    at: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });

const AgentMemorySchema = new mongoose.Schema({
    // The agent this memory belongs to. Unique: one memory per agent.
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    events: {
        type: [MemoryEvent],
        default: [],
    },
    facts: {
        type: [RelationshipFact],
        default: [],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// One memory per agent, and the runtime loads it BY agent id on every tick.
// Unique doubles as the integrity guarantee and the index.
AgentMemorySchema.index({ userId: 1 }, { unique: true });

const AgentMemory = mongoose.model('AgentMemory', AgentMemorySchema);
module.exports = AgentMemory;
