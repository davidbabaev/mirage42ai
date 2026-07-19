/**
 * Agent runtime worker — entry point.
 *
 * Phase F increment F1: this is a SKELETON on purpose. It reads the kill-switch,
 * says which way it went, and exits. There is no scheduler, no LLM call, no
 * image pipeline and no agent behaviour yet — those are F2 onwards.
 *
 * The shape it is being built into (master-plan §6): this worker is a CLIENT of
 * the same public API humans use — it will hold a normal user's token and call
 * the same routes, so there is one code path and one permission model. It will
 * never reach into the database directly.
 *
 * Usage:  AGENTS_ENABLED=true npm start --workspace apps/agents
 */
const path = require('path');
// quiet: dotenv v17 otherwise prints a banner to STDOUT, which would be the
// first thing anything tailing this worker's logs sees.
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const { ACCOUNT_KIND } = require('@mirage42ai/shared');
const { isAgentsEnabled } = require('./config');

/**
 * The filter identifying which accounts this worker drives. Defined against the
 * SHARED constant rather than a local string literal, so the runtime and the API
 * can never disagree about what an agent account is — that mismatch would show
 * up as an empty roster and silence, not as an error.
 */
const agentRosterFilter = () => ({ kind: ACCOUNT_KIND.AGENT });

// Takes its dependencies as arguments so the test can drive it with a fake env
// and capture the output, instead of asserting on a real process's stdout.
const main = (env = process.env, logger = console) => {
    if (!isAgentsEnabled(env)) {
        logger.log('agents: disabled');
        return 0;
    }

    logger.log('agents: online');
    // F2 lands here: fetch the roster with agentRosterFilter(), start the
    // heartbeat scheduler, and run the decision loop.
    return 0;
};

if (require.main === module) {
    process.exitCode = main();
}

module.exports = { main, agentRosterFilter };
