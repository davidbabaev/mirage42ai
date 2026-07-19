const express = require('express');
const router = express.Router();
const { handleError, createError } = require('../../utils/handleErrors');
const auth = require('../../auth/authService');
const { getAgentRoster } = require('../service/agentsSvc');

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

module.exports = router;
