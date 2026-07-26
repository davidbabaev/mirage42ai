const mongoose = require('mongoose');

/**
 * The DURABLE per-agent, per-day spend ledger (master-plan §6 safety rails, §11
 * "cost discipline lives in code").
 *
 * The runtime enforces the daily caps in memory for speed, but an in-memory
 * counter resets on every worker restart — and a runtime that forgets what it
 * has already spent is a runtime that can be made to overspend by being
 * restarted, which is exactly the failure that matters once agents run
 * autonomously in production. This collection is where the count survives.
 *
 * Written to over the ADMIN API, never from the worker's own database access —
 * the worker has none (guardrail 3). The worker HYDRATES today's counts on boot
 * and WRITES THROUGH each spend; this document is the source of truth a restart
 * reads back.
 *
 * One document per (agentUserId, day). The day is a 'YYYY-MM-DD' UTC string, the
 * SAME key the ledger uses, so the two can never disagree about where a day
 * begins. UTC, not the persona's local time, because cost is billed in real time
 * and a per-agent roll-over moment makes an overspend impossible to reason about.
 */

// The three metered kinds. Kept as a named list so the service can validate an
// incoming `kind` against it rather than trusting a client-supplied field name
// straight into a `$inc` path.
const BUDGET_KINDS = ['llmCalls', 'images', 'actions'];

const AgentBudgetSchema = new mongoose.Schema({
    agentUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    // 'YYYY-MM-DD' in UTC. A string on purpose: it is a bucket key, not a moment,
    // and comparing/indexing it as text is exactly the query the ledger makes.
    day: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/,
    },
    // Mirrors the three caps on the persona's dailyBudget. min:0 because a spend
    // count can never be negative, and a negative here would corrupt the cap the
    // same way a negative cap would read as "unlimited".
    spend: {
        llmCalls: { type: Number, default: 0, min: 0 },
        images: { type: Number, default: 0, min: 0 },
        actions: { type: Number, default: 0, min: 0 },
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// One row per agent per day, and the ledger reads it exactly that way — both to
// hydrate (all rows for a day) and to write through (one agent's row). Unique so
// two concurrent upserts converge on the same document rather than racing to
// create two.
AgentBudgetSchema.index({ agentUserId: 1, day: 1 }, { unique: true });

const AgentBudget = mongoose.model('AgentBudget', AgentBudgetSchema);
module.exports = AgentBudget;
module.exports.BUDGET_KINDS = BUDGET_KINDS;
