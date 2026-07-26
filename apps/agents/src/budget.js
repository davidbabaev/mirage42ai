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
 * The in-memory Map is the fast path — every check() and record() reads and
 * writes it synchronously, so a tick never blocks on the network for a cost
 * decision. But in-memory ALONE resets on a restart, and a runtime that forgets
 * what it already spent can be made to overspend by being restarted. So the Map
 * is now backed by a durable ledger over the admin API: hydrate() seeds it from
 * the server on boot, and record() WRITES THROUGH each spend. The Map stays
 * authoritative for this process; the server is what a restart reads back.
 *
 * The write-through is best-effort and deliberately NOT awaited (see record()):
 * a slow ledger write must never stall a tick, and losing the last increment to
 * a crash-in-the-window is a far smaller failure than a full reset. This is a
 * single-worker design — two workers are not race-proof against each other, and
 * that is noted as a follow-up.
 */

const DEFAULTS = { llmCalls: 40, images: 1, actions: 20 };

const utcDayKey = (now) => new Date(now).toISOString().slice(0, 10);

class BudgetLedger {
    /**
     * @param {object} [opts]
     * @param {() => number} [opts.clock]   injectable so tests need not wait a day
     * @param {(spend: {agentId,kind,amount,day}) => Promise<any>} [opts.persist]
     *   write-through sink; null (the default) keeps the ledger purely in-memory,
     *   which is what every unit test wants.
     * @param {object} [opts.logger]
     */
    constructor({ clock = Date.now, persist = null, logger = console } = {}) {
        this.clock = clock;
        this.persist = persist;
        this.logger = logger;
        this.spend = new Map(); // `${agentId}:${day}` -> { llmCalls, images, actions }
    }

    /**
     * Seeds today's buckets from the durable ledger (call once, on boot, after
     * the roster is known). Without this a restart mid-day starts every count at
     * zero and the cap forgets the morning's spend.
     *
     * @param {Array<{agentUserId: string, spend: object}>} budgets
     */
    hydrate(budgets = []) {
        const day = utcDayKey(this.clock());
        for (const entry of budgets) {
            if (!entry?.agentUserId) continue;
            this.spend.set(`${entry.agentUserId}:${day}`, {
                llmCalls: entry.spend?.llmCalls || 0,
                images: entry.spend?.images || 0,
                actions: entry.spend?.actions || 0,
            });
        }
        return this;
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

        // Write through so the count survives a restart. NOT awaited: the
        // in-memory value is already authoritative for this process, and a tick
        // must never block on the ledger write. A failure is logged, not thrown
        // — a durable-ledger outage must not stop the agent from acting.
        if (this.persist) {
            const day = utcDayKey(this.clock());
            Promise.resolve()
                .then(() => this.persist({ agentId, kind, amount, day }))
                .catch((err) => this.logger?.error?.(
                    `agents: budget write-through failed (${agentId}/${kind}) — ${err.message}`
                ));
        }

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
