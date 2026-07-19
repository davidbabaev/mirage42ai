// REGRESSION: the worker authenticated, logged "heartbeat started", and then
// exited immediately — startup lines in the log and not one decision entry.
//
// Cause: Scheduler.start() called timer.unref(), which tells Node the timer
// must not keep the event loop alive. Between ticks that timer is the ONLY
// thing referencing the loop, so it drained the moment start() returned and
// zero ticks ever fired.
//
// WHY THE SUITE MISSED IT: every other scheduler test injects setTimeoutImpl,
// so unref() was a no-op on a fake timer object. The bug lived exactly in the
// gap between "unit tests with injected timers" and "the real process with
// real timers". These tests close that gap — the first pair by asserting on
// the real timer handle, the second by running an actual process.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const requireFromHere = createRequire(import.meta.url);
const { Scheduler } = requireFromHere('../src/scheduler.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures/tickForever.js');

describe('Scheduler — the timer must keep the process alive', () => {
    it('NEVER calls unref() on the heartbeat timer', async () => {
        const unref = vi.fn();
        const setTimeoutImpl = vi.fn(() => ({ unref }));

        const s = new Scheduler({
            setTimeoutImpl,
            clearTimeoutImpl: () => {},
            random: () => 0.5,
        });
        s.start(async () => {});

        // The direct regression assertion. unref() here is the whole bug.
        expect(unref).not.toHaveBeenCalled();
        s.stop();
    });

    it('uses a REAL timer handle that is referenced by the event loop', () => {
        // Node's Timeout exposes hasRef(). A ref'd timer is what holds the
        // process open between ticks.
        const s = new Scheduler({ baseMs: 60_000, jitter: 0 });
        s.start(async () => {});

        expect(typeof s.timer.hasRef).toBe('function');
        expect(s.timer.hasRef()).toBe(true);

        s.stop();
    });
});

// These spawn a real node process. They are the tests that would actually have
// caught the defect, because the unit tests above can only assert on a handle —
// they cannot prove the OS process stays up.
describe('Scheduler — as a real, long-lived process', () => {
    // NOTE: nextDelay() floors every delay at 1000ms to make a busy-loop
    // impossible, so the effective tick interval here is 1s no matter how low
    // TICK_MS is set. Deadlines below are sized against 1s, not TICK_MS.
    const EFFECTIVE_TICK_MS = 1000;
    const TICK_MS = 150;

    /**
     * Runs the fixture until it has emitted `wantTicks` ticks or the deadline
     * passes, then SIGINTs it and resolves with the outcome.
     */
    const runUntil = (wantTicks, deadlineMs) => new Promise((resolve) => {
        const child = spawn(process.execPath, [FIXTURE], {
            env: { ...process.env, TICK_MS: String(TICK_MS) },
        });

        let out = '';
        let exitedEarly = false;
        let signalled = false;

        const deadline = setTimeout(() => {
            if (!signalled) { signalled = true; child.kill('SIGINT'); }
        }, deadlineMs);

        child.stdout.on('data', (chunk) => {
            out += chunk.toString();
            const ticks = (out.match(/^tick /gm) || []).length;
            if (ticks >= wantTicks && !signalled) {
                signalled = true;
                child.kill('SIGINT');
            }
        });

        child.on('exit', (code) => {
            clearTimeout(deadline);
            resolve({
                out,
                code,
                ticks: (out.match(/^tick /gm) || []).length,
                exitedEarly,
                stoppedCleanly: /^stopped after \d+$/m.test(out),
            });
        });

        // If it dies before we ever signal it, that IS the bug.
        child.on('close', () => { if (!signalled) exitedEarly = true; });
    });

    it('does NOT exit after scheduling — it ticks MORE THAN ONCE', async () => {
        const r = await runUntil(3, 6000);

        expect(r.out).toContain('scheduled');
        // The heart of the regression: with unref() this was 0.
        expect(r.ticks).toBeGreaterThanOrEqual(3);
    }, 20_000);

    it('stays alive across a span far longer than one interval', async () => {
        // Before the fix the process was gone within milliseconds of
        // "scheduled" — long before the first tick could fire. Five ticks at a
        // 1s floor is ~5s of continuous uptime.
        const want = 5;
        const r = await runUntil(want, want * EFFECTIVE_TICK_MS + 4000);
        expect(r.ticks).toBeGreaterThanOrEqual(want);
    }, 25_000);

    it('shuts down cleanly on SIGINT, draining rather than being killed', async () => {
        const r = await runUntil(2, 6000);

        expect(r.stoppedCleanly).toBe(true);
        // Exit code 0 from a drained loop — not a signal death.
        expect(r.code).toBe(0);
    }, 20_000);

    it('stops ticking once stopped — no runaway after shutdown', async () => {
        const r = await runUntil(2, 6000);

        const stopLine = /stopped after (\d+)/.exec(r.out);
        expect(stopLine).toBeTruthy();
        const atStop = Number(stopLine[1]);
        // No further "tick" lines after the stop line.
        expect(r.ticks).toBe(atStop);
    }, 20_000);
});
