/**
 * The heartbeat (master-plan §6, "Scheduler — the 'alive' illusion").
 *
 * Ticks each agent at human-irregular intervals, ONLY inside its persona's
 * waking hours in its own timezone. §6 is blunt about why: "Nobody posts at 4am
 * unless their persona is an insomniac." A perfectly regular tick is the single
 * most obvious bot tell there is, so the interval is jittered rather than fixed.
 *
 * F3 uses a plain setTimeout ticker rather than BullMQ/Redis, per the increment
 * scope. The seam is deliberate: `Scheduler` owns only WHEN, and calls an
 * injected `onTick`. Swapping in a real queue later means replacing this file
 * and nothing else.
 */

const DEFAULT_BASE_MS = 15 * 60 * 1000; // 15 minutes between heartbeats
const DEFAULT_JITTER = 0.5;             // ±50%

/**
 * The hour of day (0-23) at a given instant, in an IANA timezone.
 *
 * Uses Intl rather than arithmetic on UTC offsets so DST is handled by the
 * platform. A hand-rolled offset would be correct for about half the year.
 */
const hourInTimezone = (instant, timeZone) => {
    try {
        const hour = new Intl.DateTimeFormat('en-GB', {
            timeZone, hour: '2-digit', hour12: false,
        }).format(new Date(instant));
        return Number(hour) % 24;
    } catch {
        // An unknown timezone must not take the agent offline silently, and
        // must not crash the worker either. Fall back to UTC and let the
        // caller's audit trail show the persona is misconfigured.
        return new Date(instant).getUTCHours();
    }
};

/**
 * Is `hour` inside [start, end]? Handles a window that WRAPS midnight
 * (22 -> 2), which is a normal shape for a real person and would be an
 * inverted, always-false range under a naive start <= h <= end.
 */
const hourIsWithin = (hour, start, end) => (
    start <= end
        ? hour >= start && hour <= end
        : hour >= start || hour <= end
);

/** Is this persona awake right now? */
const isAwake = (persona, now = Date.now()) => {
    const start = persona?.activeHours?.start;
    const end = persona?.activeHours?.end;
    if (start === undefined || end === undefined) return true; // unconstrained
    return hourIsWithin(hourInTimezone(now, persona.timezone), start, end);
};

/**
 * A jittered delay around `baseMs`. `random` is injectable so tests are not
 * flaky — and so the schedule is reproducible when debugging a run.
 */
const nextDelay = ({ baseMs = DEFAULT_BASE_MS, jitter = DEFAULT_JITTER, random = Math.random } = {}) => {
    const spread = baseMs * jitter;
    const delay = baseMs - spread + random() * spread * 2;
    // Never return 0 or negative: a zero delay is a busy loop, and setTimeout
    // would happily oblige.
    return Math.max(1000, Math.round(delay));
};

class Scheduler {
    constructor({
        baseMs = DEFAULT_BASE_MS,
        jitter = DEFAULT_JITTER,
        random = Math.random,
        clock = Date.now,
        setTimeoutImpl = setTimeout,
        clearTimeoutImpl = clearTimeout,
        logger = console,
    } = {}) {
        this.baseMs = baseMs;
        this.jitter = jitter;
        this.random = random;
        this.clock = clock;
        this.setTimeoutImpl = setTimeoutImpl;
        this.clearTimeoutImpl = clearTimeoutImpl;
        this.logger = logger;
        this.timer = null;
        this.running = false;
        this.tickCount = 0;
    }

    /**
     * Starts ticking. `onTick(now)` is awaited; a throw inside it is logged and
     * swallowed so one bad tick never stops the heartbeat — an agent that goes
     * permanently silent because of one transient API error is the failure mode
     * to avoid.
     */
    start(onTick) {
        if (this.running) return this;
        this.running = true;

        const schedule = () => {
            if (!this.running) return;
            const delay = nextDelay({ baseMs: this.baseMs, jitter: this.jitter, random: this.random });
            this.timer = this.setTimeoutImpl(async () => {
                if (!this.running) return;
                this.tickCount += 1;
                try {
                    await onTick(this.clock());
                } catch (err) {
                    this.logger.error?.(`agents: tick failed — ${err.message}`);
                }
                schedule();
            }, delay);
            // DO NOT unref() this timer.
            //
            // Between ticks, the pending timer is the ONLY thing referencing
            // the event loop — there is no server socket and no open handle to
            // hold the process up. unref()ing it tells Node "this timer must
            // not keep the process alive", so the loop drains the moment
            // start() returns and the worker exits before a single tick fires:
            // startup lines in the log, then silence. A signal handler does not
            // rescue it either. This was shipped once; see tests/scheduler.
        };

        schedule();
        return this;
    }

    stop() {
        this.running = false;
        if (this.timer) this.clearTimeoutImpl(this.timer);
        this.timer = null;
        return this;
    }
}

module.exports = {
    Scheduler, isAwake, hourIsWithin, hourInTimezone, nextDelay,
    DEFAULT_BASE_MS, DEFAULT_JITTER,
};
