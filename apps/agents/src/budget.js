/**
 * Per-agent daily budget caps (master-plan §6 safety rails, §11 "cost
 * discipline lives in code, not in intentions").
 *
 * These are enforced BEFORE the spend happens, not reported after it. A cap
 * that is only observed is not a cap.
 *
 * Scope is one UTC day per agent. UTC rather than the persona's local timezone
 * deliberately: the budget is a COST control, and cost is billed in real time,
 * not in the agent's imagination. Using local time would also mean the roll-over
 * moment differs per agent, which makes an overspend much harder to reason
 * about at 3am.
 *
 * In-memory on purpose for F3: a single worker process, and a restart resetting
 * the counter is an acceptable failure mode while the whole runtime runs on one
 * machine in dev. It is NOT acceptable once the runtime is restartable in
 * production — noted in the backlog.
 */

const DEFAULTS = { llmCalls: 40, images: 1, actions: 20 };

const utcDayKey = (now) => new Date(now).toISOString().slice(0, 10);

class BudgetLedger {
    /** @param {() => number} clock injectable so tests need not wait a day */
    constructor({ clock = Date.now } = {}) {
        this.clock = clock;
        this.spend = new Map(); // `${agentId}:${day}` -> { llmCalls, images, actions }
    }

    _bucket(agentId) {
        const key = `${agentId}:${utcDayKey(this.clock())}`;
        if (!this.spend.has(key)) {
            this.spend.set(key, { llmCalls: 0, images: 0, actions: 0 });
        }
        return this.spend.get(key);
    }

    /** What this agent has spent today. */
    spentToday(agentId) {
        return { ...this._bucket(agentId) };
    }

    /**
     * May this agent spend one unit of `kind` right now?
     * Returns { allowed, spent, cap, remaining }.
     */
    check(agentId, kind, caps = {}) {
        const cap = Number.isFinite(caps[kind]) ? caps[kind] : DEFAULTS[kind];
        const spent = this._bucket(agentId)[kind] ?? 0;
        // A cap of 0 means "never" and must be honoured, so compare with <.
        return { allowed: spent < cap, spent, cap, remaining: Math.max(0, cap - spent) };
    }

    /** Records one unit of spend. Call only after the spend actually happened. */
    record(agentId, kind, amount = 1) {
        const bucket = this._bucket(agentId);
        bucket[kind] = (bucket[kind] ?? 0) + amount;
        return { ...bucket };
    }

    /**
     * Drops buckets from previous days so a long-running worker does not grow
     * a map entry per agent per day forever.
     */
    prune() {
        const today = utcDayKey(this.clock());
        for (const key of this.spend.keys()) {
            if (!key.endsWith(`:${today}`)) this.spend.delete(key);
        }
    }
}

module.exports = { BudgetLedger, DEFAULTS, utcDayKey };
