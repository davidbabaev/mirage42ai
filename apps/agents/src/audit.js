/**
 * The agent audit trail (master-plan §6: "all agent actions logged to an audit
 * trail").
 *
 * Every decision AND every action is recorded — including the ticks where
 * nothing happened. A trail that only logs actions cannot answer the two
 * questions that actually come up: "why has she been silent all afternoon?"
 * and "what made her say that?".
 *
 * One JSON object per line (JSONL) on stdout: greppable, machine-readable,
 * and it composes with whatever the host does with logs later. F3 deliberately
 * does not add a database collection for this — the shape will change once
 * there is more than one agent, and a log line is far cheaper to change than a
 * schema.
 *
 * NEVER logs the access token, the refresh cookie, or the API key.
 */

const redact = (value) => {
    if (typeof value !== 'string') return value;
    // Belt and braces: nothing should reach here in the first place, but an
    // audit line is exactly the kind of place a credential ends up by accident.
    if (/^sk-ant-/.test(value)) return '<redacted:api-key>';
    if (/^ey[A-Za-z0-9_-]{10,}\./.test(value)) return '<redacted:jwt>';
    return value;
};

/**
 * Keys whose VALUE is a credential.
 *
 * Anchored whole-key matching, NOT a substring test. A substring test on
 * "token" also swallows `inputTokens` / `outputTokens` — which are exactly the
 * numbers the per-agent cost story depends on. Over-broad redaction destroys
 * the audit trail just as effectively as no redaction leaks it.
 */
const SECRET_KEY = /^(token|access[-_]?token|refresh[-_]?token|auth[-_]?token|refresh[-_]?cookie|cookie|password|api[-_]?key|secret|authorization)$/i;

const redactDeep = (obj) => {
    if (Array.isArray(obj)) return obj.map(redactDeep);
    if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => (
                SECRET_KEY.test(k) ? [k, '<redacted>'] : [k, redactDeep(v)]
            ))
        );
    }
    return redact(obj);
};

class AuditTrail {
    constructor({ sink = console, clock = () => new Date().toISOString() } = {}) {
        this.sink = sink;
        this.clock = clock;
        this.entries = [];
    }

    record(event) {
        const entry = redactDeep({ at: this.clock(), ...event });
        this.entries.push(entry);
        this.sink.log?.(JSON.stringify(entry));
        return entry;
    }

    /** A heartbeat fired and the model was asked what to do. */
    decision({ agentId, agentName, decision, usage, valid, refused, error }) {
        return this.record({
            type: 'decision',
            agentId,
            agentName,
            action: decision?.action,
            reason: decision?.reason,
            valid: valid !== false,
            refused: Boolean(refused),
            error: error || undefined,
            inputTokens: usage?.input_tokens,
            outputTokens: usage?.output_tokens,
        });
    }

    /** An action was actually executed against the API. */
    action({ agentId, agentName, action, target, ok, detail }) {
        return this.record({
            type: 'action', agentId, agentName, action, target, ok: Boolean(ok), detail,
        });
    }

    /** A tick was skipped without asking the model anything. */
    skipped({ agentId, agentName, why, detail }) {
        return this.record({ type: 'skipped', agentId, agentName, why, detail });
    }
}

module.exports = { AuditTrail, redactDeep };
