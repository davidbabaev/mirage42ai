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

const DEFAULT_API_URL = 'http://localhost:8181';

/**
 * The agent's credentials, read from the environment (master-plan §8: fail fast
 * and loud on missing config instead of a weird crash later).
 *
 * These are a live password for a real account, so they live ONLY in the
 * environment — never in git, never in a default. Missing config is an error
 * here rather than an authentication failure three layers down, where the
 * message would be "401" and the cause would be invisible.
 *
 * Pure function of an env object; returns a plain config, touches nothing.
 */
const readAgentCredentials = (env = {}) => {
    const missing = ['AGENT_EMAIL', 'AGENT_PASSWORD'].filter(
        (key) => typeof env[key] !== 'string' || env[key].trim() === ''
    );

    if (missing.length) {
        throw new Error(
            `agents: missing required credential env var(s): ${missing.join(', ')}. ` +
            'Seed the agent account first (apps/api: src/seed/seedAgentPersona.js), ' +
            'then set these to the same values.'
        );
    }

    return {
        baseUrl: (env.AGENT_API_URL || '').trim() || DEFAULT_API_URL,
        email: env.AGENT_EMAIL.trim(),
        // NOT trimmed: leading/trailing whitespace can be part of a password,
        // and silently altering a credential is a maddening bug to chase.
        password: env.AGENT_PASSWORD,
    };
};

/**
 * LLM configuration. The API key is REQUIRED once agents are enabled — but a
 * missing key is a clean exit, not a crash (F3 scope): a worker that cannot
 * think should say so and stop, the same way a missing credential does.
 */
const readLlmConfig = (env = {}) => {
    const apiKey = typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : '';
    return {
        apiKey,
        hasKey: apiKey !== '',
        model: (env.AGENT_LLM_MODEL || '').trim() || undefined,
    };
};

/** Heartbeat pacing. Overridable so a dev run does not wait 15 minutes to see anything. */
const readHeartbeatConfig = (env = {}) => {
    const raw = Number(env.AGENT_HEARTBEAT_MS);
    const baseMs = Number.isFinite(raw) && raw > 0 ? raw : undefined;
    const jitterRaw = Number(env.AGENT_HEARTBEAT_JITTER);
    const jitter = Number.isFinite(jitterRaw) && jitterRaw >= 0 && jitterRaw <= 1 ? jitterRaw : undefined;
    return { baseMs, jitter };
};

module.exports = {
    isAgentsEnabled, readAgentCredentials, readLlmConfig, readHeartbeatConfig,
    TRUTHY, DEFAULT_API_URL,
};
