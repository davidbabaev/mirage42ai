// F1: the worker does exactly two things — read the kill-switch and say which
// way it went. The kill-switch is the part worth testing hard, because the
// failure mode is not a crash: it is a runtime that quietly starts acting as
// people when nobody meant it to.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const requireFromHere = createRequire(import.meta.url);
const { isAgentsEnabled } = requireFromHere('../src/config.js');
const { main, agentRosterFilter } = requireFromHere('../src/index.js');
const { ACCOUNT_KIND } = requireFromHere('@mirage42ai/shared');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, '../src/index.js');

// Captures logger.log calls instead of writing to the real console.
const captureRun = (env) => {
    const lines = [];
    const code = main(env, { log: (msg) => lines.push(msg) });
    return { lines, code };
};

describe('isAgentsEnabled — the kill-switch', () => {
    it('is OFF when AGENTS_ENABLED is absent', () => {
        expect(isAgentsEnabled({})).toBe(false);
    });

    it('is OFF for empty, whitespace, and nonsense values', () => {
        for (const v of ['', '   ', 'maybe', '0', 'false', 'no', 'off']) {
            expect(isAgentsEnabled({ AGENTS_ENABLED: v })).toBe(false);
        }
    });

    it('is ON only for explicit affirmative values', () => {
        for (const v of ['true', '1', 'yes', 'on', 'TRUE', ' True ']) {
            expect(isAgentsEnabled({ AGENTS_ENABLED: v })).toBe(true);
        }
    });

    it('is OFF for non-string values (a stray boolean or number)', () => {
        expect(isAgentsEnabled({ AGENTS_ENABLED: true })).toBe(false);
        expect(isAgentsEnabled({ AGENTS_ENABLED: 1 })).toBe(false);
    });
});

describe('worker main()', () => {
    it('logs "agents: disabled" and exits 0 when the switch is off', () => {
        const { lines, code } = captureRun({});
        expect(lines).toEqual(['agents: disabled']);
        expect(code).toBe(0);
    });

    it('logs "agents: online" and exits 0 when the switch is on', () => {
        const { lines, code } = captureRun({ AGENTS_ENABLED: 'true' });
        expect(lines).toEqual(['agents: online']);
        expect(code).toBe(0);
    });

    it('selects its roster using the SHARED account-kind constant', () => {
        expect(agentRosterFilter()).toEqual({ kind: ACCOUNT_KIND.AGENT });
        expect(agentRosterFilter().kind).toBe('agent');
    });
});

// main() is a pure function; these prove the actual process behaves the same —
// that it wires main() to stdout and terminates instead of hanging.
describe('worker as a real process', () => {
    const run = (env) =>
        execFileSync(process.execPath, [ENTRY], {
            env: { ...process.env, AGENTS_ENABLED: '', ...env },
            encoding: 'utf8',
            timeout: 20_000,
        }).trim();

    it('prints "agents: disabled" and exits cleanly by default', () => {
        expect(run({})).toBe('agents: disabled');
    });

    it('prints "agents: online" when AGENTS_ENABLED=true', () => {
        expect(run({ AGENTS_ENABLED: 'true' })).toBe('agents: online');
    });
});
