const AgentBudget = require('../models/AgentBudget');
const { BUDGET_KINDS } = require('../models/AgentBudget');
const { createError } = require('../../utils/handleErrors');

/**
 * The durable budget ledger's business logic (F5 follow-up, §6/§11).
 *
 * Two operations, and only two: read a whole day's spend so the worker can
 * HYDRATE its in-memory ledger after a restart, and INCREMENT one agent's spend
 * so a spend survives that restart. There is no decrement and no reset — a
 * budget that can be talked back down is not a cap, and the day roll-over is
 * handled by writing to a new day's row, never by zeroing an old one.
 */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = new Set(BUDGET_KINDS);

const assertDay = (day) => {
    if (typeof day !== 'string' || !DAY_PATTERN.test(day)) {
        throw createError(400, 'day is required as a YYYY-MM-DD (UTC) string');
    }
};

/**
 * Every agent's spend for one UTC day. The shape mirrors what the ledger's
 * hydrate() expects: a flat list of { agentUserId, spend }.
 */
const getBudgetForDay = async (day) => {
    assertDay(day);
    const rows = await AgentBudget.find({ day }, 'agentUserId spend').lean();
    return rows.map((row) => ({
        agentUserId: String(row.agentUserId),
        spend: {
            llmCalls: row.spend?.llmCalls || 0,
            images: row.spend?.images || 0,
            actions: row.spend?.actions || 0,
        },
    }));
};

/**
 * Records one (or more) units of spend for one agent on one day.
 *
 * An atomic upserting `$inc`: the first spend of the day creates the row, every
 * later one adds to it, and two write-throughs arriving at once both land rather
 * than one clobbering the other. `kind` is validated against the known set
 * BEFORE it reaches the `$inc` path — a client-supplied field name must never be
 * interpolated into a query untrusted.
 */
const incrementBudget = async ({ agentUserId, day, kind, amount = 1 } = {}) => {
    if (!agentUserId) throw createError(400, 'agentUserId is required');
    assertDay(day);
    if (!KINDS.has(kind)) {
        throw createError(400, `Unknown budget kind '${kind}' (expected one of: ${BUDGET_KINDS.join(', ')})`);
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
        throw createError(400, 'amount must be a positive number');
    }

    const updated = await AgentBudget.findOneAndUpdate(
        { agentUserId, day },
        { $inc: { [`spend.${kind}`]: amt }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return {
        agentUserId: String(updated.agentUserId),
        day,
        spend: {
            llmCalls: updated.spend?.llmCalls || 0,
            images: updated.spend?.images || 0,
            actions: updated.spend?.actions || 0,
        },
    };
};

module.exports = { getBudgetForDay, incrementBudget };
