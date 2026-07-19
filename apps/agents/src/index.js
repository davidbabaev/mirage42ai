/**
 * Agent runtime worker — entry point.
 *
 * Phase F increment F3: the worker is ALIVE. It authenticates, discovers its
 * roster through the admin API, and heartbeats each agent inside its persona's
 * waking hours. Each tick gathers context from the public API, makes ONE cheap
 * LLM call for a structured decision, and executes it — usually by doing
 * nothing, which is the point (master-plan §6).
 *
 * It is a CLIENT of the same public API humans use (§3). It holds a normal
 * user's token and calls the same routes. It has NO database access, and that
 * is the invariant to protect: the moment an agent needs a special route,
 * agents have stopped being users.
 *
 * Usage:  AGENTS_ENABLED=true npm start --workspace apps/agents
 * Full dev-run recipe: apps/agents/README.md
 */
const path = require('path');
// quiet: dotenv v17 otherwise prints a banner to STDOUT, which would be the
// first thing anything tailing this worker's logs sees.
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const { ACCOUNT_KIND } = require('@mirage42ai/shared');
const {
    isAgentsEnabled, readAgentCredentials, readRuntimeCredentials,
    readLlmConfig, readHeartbeatConfig,
} = require('./config');
const { AgentSession } = require('./session');
const { Scheduler } = require('./scheduler');
const { BudgetLedger } = require('./budget');
const { AuditTrail } = require('./audit');
const { runTick } = require('./loop');

/**
 * The filter identifying which accounts this worker drives. Defined against the
 * SHARED constant rather than a local string literal, so the runtime and the API
 * can never disagree about what an agent account is — that mismatch would show
 * up as an empty roster and silence, not as an error.
 */
const agentRosterFilter = () => ({ kind: ACCOUNT_KIND.AGENT });

/**
 * How the agent refers to itself in logs. The User schema lowercases
 * name/lastName, so this comes back lowercase — that is the stored truth.
 */
const displayName = (user) =>
    [user?.name, user?.lastName].filter(Boolean).join(' ').trim() || 'unknown';

/** Fetches the roster over the admin API. Never reads the database. */
const fetchRoster = async (session) => {
    const body = await session.request('/agents/admin');
    return body?.agents || [];
};

const main = async (env = process.env, logger = console, deps = {}) => {
    // The kill-switch is checked FIRST and short-circuits everything. When
    // agents are disabled this function must not read credentials, must not
    // touch the network, and must not construct an LLM client — "disabled"
    // means inert, not quiet.
    if (!isAgentsEnabled(env)) {
        logger.log('agents: disabled');
        return 0;
    }

    logger.log('agents: online');

    let credentials;
    let runtimeCredentials;
    try {
        credentials = readAgentCredentials(env);
        runtimeCredentials = readRuntimeCredentials(env);
    } catch (err) {
        logger.error(err.message);
        return 1;
    }

    const llm = readLlmConfig(env);
    if (!llm.hasKey) {
        // A clean exit, not a crash: a worker that cannot think should say so
        // and stop.
        logger.error('agents: ANTHROPIC_API_KEY is not set — nothing to think with. Exiting.');
        return 1;
    }

    // TWO sessions, deliberately. `session` is an ordinary user's token that
    // acts as the agent. `runtimeSession` is the admin token, used for exactly
    // one read-only endpoint and never to act.
    const session = deps.session || new AgentSession({ ...credentials, logger });
    const runtimeSession = deps.runtimeSession
        || new AgentSession({ ...runtimeCredentials, logger });
    const audit = deps.audit || new AuditTrail();
    const budget = deps.budget || new BudgetLedger();

    try {
        await session.start();
    } catch (err) {
        logger.error(`agents: authentication failed — ${err.message}`);
        return 1;
    }
    logger.log(`agent ${displayName(session.user)} authenticated`);

    let roster;
    try {
        await runtimeSession.start();
        roster = await fetchRoster(runtimeSession);
    } catch (err) {
        logger.error(`agents: could not fetch the roster — ${err.message}`);
        return 1;
    }

    if (!roster.length) {
        logger.error('agents: roster is empty — seed an agent account first. Exiting.');
        return 1;
    }
    logger.log(
        `agents: roster has ${roster.length} agent(s): ` +
        roster.map((a) => displayName(a.user)).join(', ')
    );

    // The LLM client is constructed only now — after the kill-switch, the
    // credentials, and the roster have all checked out.
    const llmClient = deps.llmClient || (() => {
        const sdk = require('@anthropic-ai/sdk');
        const Anthropic = sdk.Anthropic || sdk.default || sdk;
        return new Anthropic({ apiKey: llm.apiKey });
    })();

    const heartbeat = readHeartbeatConfig(env);
    const scheduler = deps.scheduler || new Scheduler({ ...heartbeat, logger });

    scheduler.start(async (now) => {
        budget.prune();
        for (const agent of roster) {
            await runTick({ session, llmClient, agent, budget, audit, now });
        }
    });

    logger.log('agents: heartbeat started');
    return { scheduler, session, audit, budget, roster };
};

if (require.main === module) {
    main().then((result) => {
        // A number means "we are done"; an object means the heartbeat is
        // running and the process should stay alive until it is signalled.
        if (typeof result === 'number') {
            process.exitCode = result;
            return;
        }
        const stop = () => { result.scheduler.stop(); process.exit(0); };
        process.on('SIGINT', stop);
        process.on('SIGTERM', stop);
    });
}

module.exports = { main, agentRosterFilter, displayName, fetchRoster };
