/**
 * The kill-switch (master-plan §10, Phase F).
 *
 * AGENTS_ENABLED defaults to FALSE — off unless someone deliberately turns it
 * on. A runtime that posts, comments and DMs as if it were a person is not
 * something that should start because a variable was forgotten, so absent,
 * empty, and unparseable all mean disabled.
 *
 * Kept as a pure function of an env object so it is testable without touching
 * process.env or booting the worker.
 */
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

const isAgentsEnabled = (env = {}) => {
    const raw = env.AGENTS_ENABLED;
    if (typeof raw !== 'string') return false;
    return TRUTHY.has(raw.trim().toLowerCase());
};

module.exports = { isAgentsEnabled, TRUTHY };
