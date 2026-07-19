const express = require('express');
const router = express.Router();
const { handleError, createError } = require('../../utils/handleErrors');
const auth = require('../../auth/authService');
const { getAgentRoster } = require('../service/agentsSvc');
const { loadMemory, appendEvent, appendFact } = require('../service/agentMemorySvc');
const { ACCOUNT_KIND } = require('@mirage42ai/shared');
const User = require('../../users/models/User');

/**
 * Memory belongs to an AGENT account and nothing else. Writing memory onto a
 * human's user id would be a quiet data-integrity bug — and a privacy one,
 * since memory is never exposed to the person it is about.
 */
const assertIsAgent = async (userId) => {
    const user = await User.findById(userId, 'kind').lean();
    if (!user) throw createError(404, 'No such user');
    if (user.kind !== ACCOUNT_KIND.AGENT) {
        throw createError(400, 'Memory is only available for agent accounts');
    }
};

/**
 * GET /agents/admin — the agent runtime's roster.
 *
 * Admin-only, following the inline-guard pattern every other admin route in
 * this codebase uses (`auth` populates req.user with isAdmin read fresh from
 * the DB, then the handler checks it). Registered before any `/agents/:id`
 * route so the literal segment is never captured as an id.
 *
 * WHY THIS ENDPOINT EXISTS: the worker must discover which accounts it drives
 * WITHOUT touching MongoDB (master-plan §3). Reading the DB directly would give
 * the runtime a second, privileged code path into the data — exactly the thing
 * "agents are users" is meant to prevent.
 *
 * SECURITY NOTE, worth a decision at review: this is admin-guarded, so the
 * runtime holds an admin-scoped credential. That is more authority than it
 * needs — it only ever reads this one endpoint. A dedicated non-admin
 * "runtime" capability would be a tighter fit; filed as a follow-up.
 */
router.get('/agents/admin', auth, async (req, res) => {
    try {
        if (!req.user.isAdmin) throw createError(403, 'Admin only');
        const roster = await getAgentRoster();
        res.send({ agents: roster });
    } catch (err) {
        handleError(res, err);
    }
});

/**
 * GET /agents/admin/:userId/memory — read one agent's memory.
 *
 * Same admin guard and the same reason as the roster: the runtime has no
 * database access, so continuity has to arrive over the API like everything
 * else. Memory is backstage — it records what people said to this agent and
 * what it concluded about them, so it is never on a public projection.
 */
router.get('/agents/admin/:userId/memory', auth, async (req, res) => {
    try {
        if (!req.user.isAdmin) throw createError(403, 'Admin only');
        await assertIsAgent(req.params.userId);
        const memory = await loadMemory(req.params.userId);
        res.send({
            userId: req.params.userId,
            events: memory.events || [],
            facts: memory.facts || [],
        });
    } catch (err) {
        handleError(res, err);
    }
});

/**
 * POST /agents/admin/:userId/memory — append to one agent's memory.
 *
 * Body: { events?: [{type, withUserId?, summary}], facts?: [{userId, fact}] }
 *
 * Append-only by design. There is no edit or delete: memory is a record of what
 * happened, and a runtime that could rewrite its own history could quietly
 * erase "I already turned this person down" — the one fact the whole feature
 * exists to preserve. Trimming is the service's job and is bounded by size,
 * not by anyone's say-so.
 */
router.post('/agents/admin/:userId/memory', auth, async (req, res) => {
    try {
        if (!req.user.isAdmin) throw createError(403, 'Admin only');
        await assertIsAgent(req.params.userId);

        const events = Array.isArray(req.body?.events) ? req.body.events : [];
        const facts = Array.isArray(req.body?.facts) ? req.body.facts : [];
        if (!events.length && !facts.length) {
            throw createError(400, 'Provide at least one event or fact');
        }
        // Bounded per request so a runaway loop cannot write a million entries
        // in one call and blow past the service's trim in a single shot.
        if (events.length > 20 || facts.length > 20) {
            throw createError(400, 'Too many entries in one request (max 20 each)');
        }

        for (const event of events) {
            await appendEvent(req.params.userId, event);
        }
        for (const fact of facts) {
            await appendFact(req.params.userId, fact);
        }

        const memory = await loadMemory(req.params.userId);
        res.send({
            userId: req.params.userId,
            eventCount: (memory.events || []).length,
            factCount: (memory.facts || []).length,
        });
    } catch (err) {
        handleError(res, err);
    }
});

module.exports = router;
