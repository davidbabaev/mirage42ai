// The heartbeat. Master-plan §6: "Nobody posts at 4am unless their persona is
// an insomniac", and a perfectly regular tick is the most obvious bot tell
// there is. Both of those are testable properties, so they are tested.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const {
    Scheduler, isAwake, hourIsWithin, hourInTimezone, nextDelay,
} = requireFromHere('../src/scheduler.js');

const persona = (over = {}) => ({
    timezone: 'Asia/Jerusalem',
    activeHours: { start: 7, end: 23 },
    ...over,
});

describe('hourIsWithin — windows that wrap midnight', () => {
    it('handles an ordinary daytime window', () => {
        expect(hourIsWithin(12, 7, 23)).toBe(true);
        expect(hourIsWithin(7, 7, 23)).toBe(true);
        expect(hourIsWithin(23, 7, 23)).toBe(true);
        expect(hourIsWithin(3, 7, 23)).toBe(false);
    });

    it('handles a night-owl window that crosses midnight', () => {
        // A naive start <= h <= end makes this range always false.
        expect(hourIsWithin(23, 22, 2)).toBe(true);
        expect(hourIsWithin(0, 22, 2)).toBe(true);
        expect(hourIsWithin(2, 22, 2)).toBe(true);
        expect(hourIsWithin(12, 22, 2)).toBe(false);
    });
});

describe('hourInTimezone', () => {
    it('resolves the hour in the persona\'s own zone, not the server\'s', () => {
        // 00:30 UTC is 03:30 in Jerusalem (UTC+3, summer).
        const instant = Date.parse('2026-07-19T00:30:00Z');
        expect(hourInTimezone(instant, 'Asia/Jerusalem')).toBe(3);
        expect(hourInTimezone(instant, 'UTC')).toBe(0);
    });

    it('handles DST via the platform rather than hand-rolled offsets', () => {
        const summer = Date.parse('2026-07-19T09:00:00Z'); // UTC+3
        const winter = Date.parse('2026-01-19T09:00:00Z'); // UTC+2
        expect(hourInTimezone(summer, 'Asia/Jerusalem')).toBe(12);
        expect(hourInTimezone(winter, 'Asia/Jerusalem')).toBe(11);
    });

    it('falls back to UTC on a bad timezone instead of crashing the worker', () => {
        const instant = Date.parse('2026-07-19T09:00:00Z');
        expect(() => hourInTimezone(instant, 'Not/AZone')).not.toThrow();
        expect(hourInTimezone(instant, 'Not/AZone')).toBe(9);
    });
});

describe('isAwake — nobody posts at 4am', () => {
    it('is awake inside the window', () => {
        // 09:00 UTC = 12:00 Jerusalem
        expect(isAwake(persona(), Date.parse('2026-07-19T09:00:00Z'))).toBe(true);
    });

    it('is ASLEEP at 4am local, even though it is a normal hour in UTC', () => {
        // 01:00 UTC = 04:00 Jerusalem — outside 07:00-23:00.
        const fourAmLocal = Date.parse('2026-07-19T01:00:00Z');
        expect(isAwake(persona(), fourAmLocal)).toBe(false);
        // ...and this is the case a UTC-only check would get wrong: 01:00 UTC
        // looks like the middle of the night, but the bug is the reverse case —
        expect(isAwake(persona({ timezone: 'UTC' }), fourAmLocal)).toBe(false);
    });

    it('a night owl IS awake at 1am', () => {
        const oneAmLocal = Date.parse('2026-07-18T22:00:00Z'); // 01:00 Jerusalem
        expect(isAwake(persona({ activeHours: { start: 22, end: 2 } }), oneAmLocal)).toBe(true);
    });

    it('treats a persona with no window as always awake', () => {
        expect(isAwake(persona({ activeHours: undefined }), Date.now())).toBe(true);
    });
});

describe('nextDelay — irregular on purpose', () => {
    it('is never fixed — a metronome is a bot tell', () => {
        const delays = new Set(
            Array.from({ length: 20 }, (_, i) =>
                nextDelay({ baseMs: 60_000, jitter: 0.5, random: () => i / 20 }))
        );
        expect(delays.size).toBeGreaterThan(10);
    });

    it('stays within the jitter band', () => {
        expect(nextDelay({ baseMs: 100_000, jitter: 0.5, random: () => 0 })).toBe(50_000);
        expect(nextDelay({ baseMs: 100_000, jitter: 0.5, random: () => 1 })).toBe(150_000);
        expect(nextDelay({ baseMs: 100_000, jitter: 0.5, random: () => 0.5 })).toBe(100_000);
    });

    it('never returns a delay that would busy-loop', () => {
        expect(nextDelay({ baseMs: 10, jitter: 1, random: () => 0 })).toBeGreaterThanOrEqual(1000);
    });
});

describe('Scheduler', () => {
    // A hand-driven fake timer: records the pending callback so a test can fire
    // ticks deterministically instead of waiting real minutes.
    const fakeTimers = () => {
        const pending = [];
        return {
            pending,
            setTimeoutImpl: (fn, delay) => { pending.push({ fn, delay }); return { unref() {} }; },
            clearTimeoutImpl: () => {},
            async fire() {
                const next = pending.pop();
                if (next) await next.fn();
            },
        };
    };

    it('ticks repeatedly, scheduling the next one each time', async () => {
        const timers = fakeTimers();
        const onTick = vi.fn(async () => {});
        const s = new Scheduler({ ...timers, random: () => 0.5 });

        s.start(onTick);
        await timers.fire();
        await timers.fire();
        await timers.fire();

        expect(onTick).toHaveBeenCalledTimes(3);
        expect(s.tickCount).toBe(3);
        s.stop();
    });

    it('a THROWING tick does not stop the heartbeat', async () => {
        const timers = fakeTimers();
        const errors = [];
        const onTick = vi.fn()
            .mockRejectedValueOnce(new Error('API blew up'))
            .mockResolvedValue(undefined);

        const s = new Scheduler({
            ...timers, random: () => 0.5,
            logger: { error: (m) => errors.push(m) },
        });

        s.start(onTick);
        await timers.fire();   // throws
        await timers.fire();   // must still happen

        expect(onTick).toHaveBeenCalledTimes(2);
        expect(errors[0]).toMatch(/API blew up/);
        s.stop();
    });

    it('stop() prevents further ticks', async () => {
        const timers = fakeTimers();
        const onTick = vi.fn(async () => {});
        const s = new Scheduler({ ...timers, random: () => 0.5 });

        s.start(onTick);
        s.stop();
        await timers.fire();

        expect(onTick).not.toHaveBeenCalled();
    });

    it('start() twice does not double the heartbeat rate', async () => {
        const timers = fakeTimers();
        const s = new Scheduler({ ...timers, random: () => 0.5 });
        s.start(vi.fn(async () => {}));
        s.start(vi.fn(async () => {}));
        expect(timers.pending).toHaveLength(1);
        s.stop();
    });
});
