// Fixture for the real-process scheduler test. Runs the REAL Scheduler with
// REAL timers — no injection — because that is precisely the gap the unref()
// bug lived in: every unit test passed a fake setTimeout, so unref() was a
// no-op and the defect was invisible.
//
// Prints "tick N" per tick and exits 0 on SIGINT after stopping cleanly.
const { Scheduler } = require('../../src/scheduler');

const scheduler = new Scheduler({
    baseMs: Number(process.env.TICK_MS || 150),
    jitter: 0,               // deterministic: this test is about liveness
    logger: { error: () => {} },
});

let ticks = 0;
scheduler.start(async () => {
    ticks += 1;
    process.stdout.write(`tick ${ticks}\n`);
});

process.stdout.write('scheduled\n');

process.on('SIGINT', () => {
    scheduler.stop();
    process.stdout.write(`stopped after ${ticks}\n`);
    // No process.exit(): the loop must drain on its own once the timer is
    // cleared. If it does not, the test's timeout catches it.
});
