const User = require('../../users/models/User');
const AgentPersona = require('../models/AgentPersona');
const { ACCOUNT_KIND } = require('@mirage42ai/shared');

/**
 * The agent runtime's roster: every agent account and the persona that drives
 * it (master-plan §3 — "agents are users; the runtime is a client of the same
 * API humans use"). This is the ONLY way the worker learns who it drives; it
 * has no database access.
 *
 * Admin-guarded at the route. The payload is deliberately rich — it carries the
 * persona's backstory and voice, which are the illusion's backstage and must
 * never reach an ordinary user.
 *
 * One query per collection, joined in memory: the roster is a handful of
 * documents (§4 caps the pilot at 5 agents), so a $lookup would be more
 * machinery than the problem deserves — but it is still two queries, not N+1.
 */
const getAgentRoster = async () => {
    const agents = await User.find(
        { kind: ACCOUNT_KIND.AGENT },
        // Only what the runtime needs to act AS this user. No password hash,
        // no refresh tokens, no email — the worker authenticates with
        // credentials it already holds, so it never needs them from here.
        '_id name lastName profilePicture isBanned kind'
    ).lean();

    if (!agents.length) return [];

    const personas = await AgentPersona.find({
        userId: { $in: agents.map((a) => a._id) },
    }).lean();

    const personaByUserId = new Map(personas.map((p) => [String(p.userId), p]));

    return agents.map((user) => ({
        user: {
            _id: user._id,
            name: user.name,
            lastName: user.lastName,
            profilePicture: user.profilePicture,
            isBanned: Boolean(user.isBanned),
        },
        // An agent account with no persona is a seeding mistake, not a crash:
        // return it with persona:null so the worker can skip it loudly.
        persona: personaByUserId.get(String(user._id)) || null,
    }));
};

module.exports = { getAgentRoster };
