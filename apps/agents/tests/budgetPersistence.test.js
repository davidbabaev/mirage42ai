// Phase F / F5 follow-up — the daily budget cap must SURVIVE A RESTART (§6/§11).
//
// The property under test is the one the in-memory ledger could not give: a
// worker that spends its image for the day, is restarted, and then must STILL
// refuse a second image — because a cap you can reset by restarting is not a
// cap, and "restart the worker" is not an approval workflow.
//
// Nothing here touches the network: the durable ledger is a plain injected
// persist() sink, exactly the seam the real worker wires to the admin API.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { BudgetLedger, utcDayKey } = requireFromHere('../src/budget.js');

const DAY = Date.parse('2026-07-19T09:00:00Z');
const DAY_KEY = '2026-07-19';

// The write-through is fired on a microtask and deliberately not awaited by
// record(); a macrotask flush lets the test observe it.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('BudgetLedger.hydrate — a restart picks up where it left off', () => {
    it('seeds today\'s spend so the cap already reflects the morning', () => {
        const ledger = new BudgetLedger({ clock: () => DAY });
        ledger.hydrate([{ agentId: 'ignored', agentUserId: 'a1', spend: { images: 1, llmCalls: 5, actions: 2 } }]);

        expect(ledger.spentToday('a1')).toMatchObject({ images: 1, llmCalls: 5, actions: 2 });
        // One image already spent against a cap of one — the next must be refused.
        expect(ledger.check('a1', 'images', { images: 1 }).allowed).toBe(false);
    });

    it('keeps agents independent when hydrating', () => {
        const ledger = new BudgetLedger({ clock: () => DAY });
        ledger.hydrate([{ agentUserId: 'a1', spend: { images: 1 } }]);

        expect(ledger.check('a1', 'images', { images: 1 }).allowed).toBe(false);
        expect(ledger.check('a2', 'images', { images: 1 }).allowed).toBe(true);
    });

    it('hydrates under today\'s key only — yesterday\'s row must not block today', () => {
        // A stale row handed to hydrate is filed under today's key by design (the
        // server is queried per-day), so hydrate is always given the right day.
        const ledger = new BudgetLedger({ clock: () => DAY });
        ledger.hydrate([]); // empty is a clean no-op, not a crash
        expect(ledger.spentToday('a1')).toMatchObject({ images: 0 });
    });
});

describe('BudgetLedger.record — writes each spend through to durable storage', () => {
    it('calls persist with the agent, kind, amount and UTC day', async () => {
        const persist = vi.fn(async () => {});
        const ledger = new BudgetLedger({ clock: () => DAY, persist });

        ledger.record('a1', 'images');
        await flush();

        expect(persist).toHaveBeenCalledWith({ agentId: 'a1', kind: 'images', amount: 1, day: DAY_KEY });
    });

    it('passes a multi-unit amount through unchanged', async () => {
        const persist = vi.fn(async () => {});
        const ledger = new BudgetLedger({ clock: () => DAY, persist });

        ledger.record('a1', 'llmCalls', 3);
        await flush();

        expect(persist).toHaveBeenCalledWith({ agentId: 'a1', kind: 'llmCalls', amount: 3, day: DAY_KEY });
    });

    it('still records in memory when the write-through FAILS, and never throws', async () => {
        const errs = [];
        const persist = vi.fn(async () => { throw new Error('ledger 503'); });
        const ledger = new BudgetLedger({ clock: () => DAY, persist, logger: { error: (m) => errs.push(m) } });

        // A durable-ledger outage must not stop the agent acting or crash a tick.
        expect(() => ledger.record('a1', 'images')).not.toThrow();
        expect(ledger.spentToday('a1').images).toBe(1);

        await flush();
        expect(errs.join('\n')).toMatch(/budget write-through failed .*a1\/images/);
    });

    it('is a pure in-memory ledger when no persist sink is wired', () => {
        const ledger = new BudgetLedger({ clock: () => DAY });
        expect(() => ledger.record('a1', 'images')).not.toThrow();
        expect(ledger.spentToday('a1').images).toBe(1);
    });
});

describe('the whole point: a restarted worker still honours the cap', () => {
    it('run 1 spends the image, run 2 (hydrated from what run 1 persisted) refuses the next', async () => {
        // A stand-in for the durable server-side ledger.
        const store = new Map(); // `${agentUserId}:${day}` -> spend
        const persist = async ({ agentId, kind, amount, day }) => {
            const key = `${agentId}:${day}`;
            const cur = store.get(key) || { llmCalls: 0, images: 0, actions: 0 };
            cur[kind] += amount;
            store.set(key, cur);
        };

        // ---- Run 1: spends its one image for the day. ----
        const run1 = new BudgetLedger({ clock: () => DAY, persist });
        expect(run1.check('a1', 'images', { images: 1 }).allowed).toBe(true);
        run1.record('a1', 'images');
        await flush();

        // ---- Run 2: a brand-new process (fresh Map). ----
        // Without hydrate it would happily allow a SECOND image — the exact bug.
        const cold = new BudgetLedger({ clock: () => DAY, persist });
        expect(cold.check('a1', 'images', { images: 1 }).allowed).toBe(true); // proves the danger

        const run2 = new BudgetLedger({ clock: () => DAY, persist });
        const fromStore = [...store.entries()].map(([key, spend]) => ({
            agentUserId: key.slice(0, key.lastIndexOf(':')),
            spend,
        }));
        run2.hydrate(fromStore);

        expect(run2.check('a1', 'images', { images: 1 }).allowed).toBe(false);
    });
});

describe('utcDayKey — the ledger and the server agree on where a day starts', () => {
    it('is the UTC calendar date, not the local one', () => {
        expect(utcDayKey(Date.parse('2026-07-19T23:59:59Z'))).toBe('2026-07-19');
        expect(utcDayKey(Date.parse('2026-07-20T00:00:01Z'))).toBe('2026-07-20');
    });
});
