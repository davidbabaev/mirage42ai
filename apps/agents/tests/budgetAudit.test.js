// Budget caps and the audit trail — both are master-plan §6 safety rails, and
// both fail in ways that are invisible if you only test the happy path.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { BudgetLedger } = requireFromHere('../src/budget.js');
const { AuditTrail, redactDeep } = requireFromHere('../src/audit.js');

const DAY_1 = Date.parse('2026-07-19T10:00:00Z');
const DAY_1_LATE = Date.parse('2026-07-19T23:59:00Z');
const DAY_2 = Date.parse('2026-07-20T00:01:00Z');

describe('BudgetLedger — caps are enforced, not merely observed', () => {
    it('allows spend up to the cap and refuses the one that would exceed it', () => {
        const ledger = new BudgetLedger({ clock: () => DAY_1 });
        const caps = { llmCalls: 3 };

        for (let i = 0; i < 3; i++) {
            expect(ledger.check('a1', 'llmCalls', caps).allowed).toBe(true);
            ledger.record('a1', 'llmCalls');
        }
        expect(ledger.check('a1', 'llmCalls', caps).allowed).toBe(false);
        expect(ledger.check('a1', 'llmCalls', caps).remaining).toBe(0);
    });

    it('honours a cap of ZERO as "never" — not as "unlimited"', () => {
        const ledger = new BudgetLedger({ clock: () => DAY_1 });
        // The classic off-by-one: `spent <= cap` would allow one image here.
        expect(ledger.check('a1', 'images', { images: 0 }).allowed).toBe(false);
    });

    it('keeps agents independent — one agent cannot spend another\'s budget', () => {
        const ledger = new BudgetLedger({ clock: () => DAY_1 });
        const caps = { actions: 1 };

        ledger.record('a1', 'actions');
        expect(ledger.check('a1', 'actions', caps).allowed).toBe(false);
        expect(ledger.check('a2', 'actions', caps).allowed).toBe(true);
    });

    it('keeps the three budgets independent', () => {
        const ledger = new BudgetLedger({ clock: () => DAY_1 });
        const caps = { llmCalls: 1, actions: 1, images: 1 };

        ledger.record('a1', 'llmCalls');
        expect(ledger.check('a1', 'llmCalls', caps).allowed).toBe(false);
        expect(ledger.check('a1', 'actions', caps).allowed).toBe(true);
        expect(ledger.check('a1', 'images', caps).allowed).toBe(true);
    });

    it('rolls over at UTC midnight', () => {
        let now = DAY_1_LATE;
        const ledger = new BudgetLedger({ clock: () => now });
        const caps = { actions: 1 };

        ledger.record('a1', 'actions');
        expect(ledger.check('a1', 'actions', caps).allowed).toBe(false);

        now = DAY_2;
        expect(ledger.check('a1', 'actions', caps).allowed).toBe(true);
        expect(ledger.spentToday('a1').actions).toBe(0);
    });

    it('falls back to sane defaults when a persona sets no cap', () => {
        const ledger = new BudgetLedger({ clock: () => DAY_1 });
        const check = ledger.check('a1', 'llmCalls', {});
        expect(check.cap).toBeGreaterThan(0);
        expect(check.allowed).toBe(true);
    });

    it('prunes stale days so a long run does not leak memory', () => {
        let now = DAY_1;
        const ledger = new BudgetLedger({ clock: () => now });
        ledger.record('a1', 'actions');
        expect(ledger.spend.size).toBe(1);

        now = DAY_2;
        ledger.record('a1', 'actions');
        expect(ledger.spend.size).toBe(2);

        ledger.prune();
        expect(ledger.spend.size).toBe(1);
    });
});

const sink = () => { const lines = []; return { lines, log: (l) => lines.push(l) }; };

describe('AuditTrail — the quiet ticks are the point', () => {
    it('records a do_nothing decision, not just actions', () => {
        const s = sink();
        const audit = new AuditTrail({ sink: s, clock: () => 'T' });

        audit.decision({
            agentId: 'a1', agentName: 'maya',
            decision: { action: 'do_nothing', reason: 'nothing worth reacting to' },
            usage: { input_tokens: 900, output_tokens: 20 },
        });

        const entry = JSON.parse(s.lines[0]);
        expect(entry.type).toBe('decision');
        expect(entry.action).toBe('do_nothing');
        // Without the reason, every quiet tick looks identical in the log.
        expect(entry.reason).toBe('nothing worth reacting to');
        expect(entry.inputTokens).toBe(900);
    });

    it('records executed actions with their target and outcome', () => {
        const s = sink();
        const audit = new AuditTrail({ sink: s, clock: () => 'T' });
        audit.action({ agentId: 'a1', action: 'like', target: 'card-9', ok: true });

        const entry = JSON.parse(s.lines[0]);
        expect(entry).toMatchObject({ type: 'action', action: 'like', target: 'card-9', ok: true });
    });

    it('records a skipped tick and why', () => {
        const s = sink();
        const audit = new AuditTrail({ sink: s, clock: () => 'T' });
        audit.skipped({ agentId: 'a1', why: 'outside-active-hours' });
        expect(JSON.parse(s.lines[0])).toMatchObject({ type: 'skipped', why: 'outside-active-hours' });
    });

    it('emits one JSON object per line', () => {
        const s = sink();
        const audit = new AuditTrail({ sink: s, clock: () => 'T' });
        audit.skipped({ agentId: 'a1', why: 'x' });
        audit.skipped({ agentId: 'a1', why: 'y' });
        expect(s.lines).toHaveLength(2);
        for (const line of s.lines) expect(() => JSON.parse(line)).not.toThrow();
    });
});

describe('AuditTrail — never logs a credential', () => {
    it('redacts secret-looking KEYS', () => {
        const out = redactDeep({ token: 'abc', password: 'p', refreshCookie: 'c', apiKey: 'k', safe: 'v' });
        expect(out.token).toBe('<redacted>');
        expect(out.password).toBe('<redacted>');
        expect(out.refreshCookie).toBe('<redacted>');
        expect(out.apiKey).toBe('<redacted>');
        expect(out.safe).toBe('v');
    });

    it('redacts secret-looking VALUES even under an innocent key', () => {
        const out = redactDeep({
            note: 'sk-ant-api03-verysecret',
            other: 'eyJhbGciOiJIUzI1NiIsInR5cCI6.payload',
        });
        expect(out.note).toBe('<redacted:api-key>');
        expect(out.other).toBe('<redacted:jwt>');
    });

    it('redacts through nesting', () => {
        const out = redactDeep({ session: { auth: { token: 'abc' } } });
        expect(out.session.auth.token).toBe('<redacted>');
    });

    it('does NOT redact token COUNTS — over-broad redaction destroys the trail', () => {
        // A substring test on "token" swallows these, and they are exactly the
        // numbers the per-agent cost story depends on. Caught by this test.
        const out = redactDeep({ inputTokens: 900, outputTokens: 20, maxTokens: 1024 });
        expect(out.inputTokens).toBe(900);
        expect(out.outputTokens).toBe(20);
        expect(out.maxTokens).toBe(1024);
    });

    it('a real audit line carries no credential', () => {
        const s = sink();
        const audit = new AuditTrail({ sink: s, clock: () => 'T' });
        audit.record({ type: 'debug', token: 'eyJreal.jwt.here', apiKey: 'sk-ant-secret' });
        expect(s.lines[0]).not.toContain('sk-ant-secret');
        expect(s.lines[0]).not.toContain('eyJreal');
    });
});
