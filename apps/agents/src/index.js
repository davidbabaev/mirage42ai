/**
 * Agent runtime worker — entry point.
 *
 * Phase F increment F2: the worker now AUTHENTICATES as its persona's user
 * account and stops there. It logs in over POST /users/login — the same route,
 * the same rate limiter and the same token a human's browser gets — and then
 * does nothing. No scheduler, no feed read, no LLM call, no posting. Those are
 * F3 onwards.
 *
 * The shape it is being built into (master-plan §6): this worker is a CLIENT of
 * the same public API humans use, holding a normal user's token. It has no
 * database access and no privileged endpoint. The moment an agent needs a
 * special route, agents have stopped being users.
 *
 * Usage:  AGENTS_ENABLED=true npm start --workspace apps/agents
 */
const path = require('path');
// quiet: dotenv v17 otherwise prints a banner to STDOUT, which would be the
// first thing anything tailing this worker's logs sees.
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const { ACCOUNT_KIND } = require('@mirage42ai/shared');
const { isAgentsEnabled, readAgentCredentials } = require('./config');
const { login } = require('./apiClient');

/**
 * The filter identifying which accounts this worker drives. Defined against the
 * SHARED constant rather than a local string literal, so the runtime and the API
 * can never disagree about what an agent account is — that mismatch would show
 * up as an empty roster and silence, not as an error.
 */
const agentRosterFilter = () => ({ kind: ACCOUNT_KIND.AGENT });

/**
 * How the agent refers to itself in logs. Uses the account's real display name
 * so operators can tell agents apart at a glance.
 *
 * NOTE: the User schema lowercases `name`/`lastName`, so this comes back
 * lowercase ("maya ben-ari"). That is the stored truth, not a formatting bug.
 */
const displayName = (user) =>
    [user?.name, user?.lastName].filter(Boolean).join(' ').trim() || 'unknown';

/**
 * Takes its dependencies as arguments so tests can drive it with a fake env,
 * a fake fetch and a captured logger rather than a live server.
 *
 * Returns a process exit code: 0 on success or a clean disabled exit, 1 when
 * the agent was meant to run and could not.
 */
const main = async (env = process.env, logger = console, deps = {}) => {
    const doLogin = deps.login || login;

    // The kill-switch is checked FIRST and short-circuits everything. When
    // agents are disabled this function must not read credentials and must not
    // touch the network at all — "disabled" means inert, not quiet.
    if (!isAgentsEnabled(env)) {
        logger.log('agents: disabled');
        return 0;
    }

    logger.log('agents: online');

    let credentials;
    try {
        credentials = readAgentCredentials(env);
    } catch (err) {
        logger.error(err.message);
        return 1;
    }

    try {
        const { user } = await doLogin(credentials);
        // Deliberately logs the NAME and never the token — the token is a
        // bearer credential for a real account and logs are not a secret store.
        logger.log(`agent ${displayName(user)} authenticated`);
        // F3 lands here: start the heartbeat scheduler and run the decision loop.
        return 0;
    } catch (err) {
        logger.error(`agents: authentication failed — ${err.message}`);
        return 1;
    }
};

if (require.main === module) {
    main().then((code) => {
        process.exitCode = code;
    });
}

module.exports = { main, agentRosterFilter, displayName };
