// F2: the worker reads the kill-switch and, when allowed, authenticates as its
// persona's account over the same public auth route a human uses.
//
// The kill-switch is the part worth testing hardest, because the failure mode
// is not a crash: it is a runtime that quietly acts as a person when nobody
// meant it to. "Disabled" therefore has to mean INERT — no credentials read,
// no network touched — not merely "logs a different line".
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const requireFromHere = createRequire(import.meta.url);
const { isAgentsEnabled, readAgentCredentials } = requireFromHere('../src/config.js');
const { main, agentRosterFilter, displayName } = requireFromHere('../src/index.js');
const { ACCOUNT_KIND } = requireFromHere('@mirage42ai/shared');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, '../src/index.js');

const ENABLED_ENV = {
    AGENTS_ENABLED: 'true',
    AGENT_API_URL: 'http://api.test:8181',
    AGENT_EMAIL: 'maya.benari@agents.mirage42.ai',
    AGENT_PASSWORD: 'AgentSeed1!',
    ANTHROPIC_API_KEY: 'sk-ant-test-not-a-real-key',
};

// Captures logger output instead of writing to the real console.
const capture = () => {
    const out = [], errs = [];
    return { out, errs, logger: { log: (m) => out.push(m), error: (m) => errs.push(m) } };
};

const okLogin = () => vi.fn(async () => ({
    token: 'a-real-looking-jwt.value.here',
    user: { _id: 'u1', name: 'maya', lastName: 'ben-ari' },
}));

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

describe('readAgentCredentials', () => {
    it('throws naming every missing variable', () => {
        expect(() => readAgentCredentials({})).toThrow(/AGENT_EMAIL.*AGENT_PASSWORD/);
        expect(() => readAgentCredentials({ AGENT_EMAIL: 'a@b.c' })).toThrow(/AGENT_PASSWORD/);
    });

    it('treats blank and whitespace-only as missing', () => {
        expect(() => readAgentCredentials({ AGENT_EMAIL: '  ', AGENT_PASSWORD: 'x' }))
            .toThrow(/AGENT_EMAIL/);
    });

    it('defaults the base URL but never the credentials', () => {
        const c = readAgentCredentials({ AGENT_EMAIL: 'a@b.c', AGENT_PASSWORD: 'pw' });
        expect(c.baseUrl).toBe('http://localhost:8181');
        expect(c.email).toBe('a@b.c');
    });

    it('does NOT trim the password (whitespace can be part of it)', () => {
        const c = readAgentCredentials({ AGENT_EMAIL: 'a@b.c', AGENT_PASSWORD: ' pw ' });
        expect(c.password).toBe(' pw ');
    });
});

describe('worker main() — disabled means INERT', () => {
    it('logs "agents: disabled", exits 0, and never calls login', async () => {
        const { out, logger } = capture();
        const doLogin = okLogin();

        const code = await main({}, logger, { login: doLogin });

        expect(out).toEqual(['agents: disabled']);
        expect(code).toBe(0);
        expect(doLogin).not.toHaveBeenCalled();
    });

    it('does not even READ credentials when disabled', async () => {
        const { out, errs, logger } = capture();
        const doLogin = okLogin();

        // Credentials are absent AND the switch is off. If the worker read
        // config before checking the switch, this would error instead of
        // exiting cleanly.
        const code = await main({ AGENTS_ENABLED: 'false' }, logger, { login: doLogin });

        expect(code).toBe(0);
        expect(errs).toEqual([]);
        expect(out).toEqual(['agents: disabled']);
        expect(doLogin).not.toHaveBeenCalled();
    });
});

// F3: main() now boots a heartbeat. It returns a NUMBER when it exits and an
// OBJECT (the running scheduler and friends) when it stays alive, so the tests
// distinguish "declined to start" from "started".
const ROSTER_AGENT = {
    user: { _id: 'a1', name: 'maya', lastName: 'ben-ari', isBanned: false },
    persona: {
        name: 'Maya', age: 31, timezone: 'Asia/Jerusalem',
        activeHours: { start: 0, end: 23 }, enabled: true,
        dailyBudget: { llmCalls: 40, actions: 20 },
    },
};

const mkSession = (roster = [ROSTER_AGENT]) => ({
    user: { name: 'maya', lastName: 'ben-ari' },
    start: vi.fn(async () => {}),
    request: vi.fn(async (p) => (p === '/agents/admin' ? { agents: roster } : {})),
});

const mkScheduler = () => ({ start: vi.fn(), stop: vi.fn() });

describe('worker main() — enabled', () => {
    it('authenticates, loads the roster, and starts the heartbeat', async () => {
        const { out, logger } = capture();
        const session = mkSession();
        const scheduler = mkScheduler();

        const result = await main(ENABLED_ENV, logger, {
            session, scheduler, llmClient: {},
        });

        expect(session.start).toHaveBeenCalled();
        expect(scheduler.start).toHaveBeenCalledTimes(1);
        expect(out).toContain('agent maya ben-ari authenticated');
        expect(out.join('\n')).toMatch(/roster has 1 agent/);
        expect(out).toContain('agents: heartbeat started');
        expect(result.scheduler).toBe(scheduler);
    });

    it('NEVER logs the token, the password, or the API key', async () => {
        const { out, errs, logger } = capture();
        await main(ENABLED_ENV, logger, {
            session: mkSession(), scheduler: mkScheduler(), llmClient: {},
        });

        const everything = [...out, ...errs].join('\n');
        expect(everything).not.toContain('AgentSeed1!');
        expect(everything).not.toContain(ENABLED_ENV.ANTHROPIC_API_KEY);
    });

    it('exits 1 with a clear message when credentials are missing', async () => {
        const { errs, logger } = capture();
        const scheduler = mkScheduler();

        const code = await main({ AGENTS_ENABLED: 'true' }, logger, { scheduler });

        expect(code).toBe(1);
        expect(errs.join()).toMatch(/AGENT_EMAIL/);
        expect(scheduler.start).not.toHaveBeenCalled();
    });

    it('exits CLEANLY when ANTHROPIC_API_KEY is missing — no crash', async () => {
        const { errs, logger } = capture();
        const session = mkSession();
        const noKey = { ...ENABLED_ENV };
        delete noKey.ANTHROPIC_API_KEY;

        const code = await main(noKey, logger, { session, scheduler: mkScheduler() });

        expect(code).toBe(1);
        expect(errs.join()).toMatch(/ANTHROPIC_API_KEY/);
        // It must not even authenticate — nothing to think with.
        expect(session.start).not.toHaveBeenCalled();
    });

    it('exits 1 when authentication is rejected, without throwing', async () => {
        const { errs, logger } = capture();
        const session = mkSession();
        session.start = vi.fn(async () => { throw new Error('login: rejected with 401'); });

        const code = await main(ENABLED_ENV, logger, { session, scheduler: mkScheduler(), llmClient: {} });

        expect(code).toBe(1);
        expect(errs.join()).toMatch(/authentication failed.*401/);
    });

    it('exits 1 on an EMPTY roster rather than heartbeating over nothing', async () => {
        const { errs, logger } = capture();
        const scheduler = mkScheduler();

        const code = await main(ENABLED_ENV, logger, {
            session: mkSession([]), scheduler, llmClient: {},
        });

        expect(code).toBe(1);
        expect(errs.join()).toMatch(/roster is empty/);
        expect(scheduler.start).not.toHaveBeenCalled();
    });

    it('exits 1 when the roster endpoint fails', async () => {
        const { errs, logger } = capture();
        const session = mkSession();
        session.request = vi.fn(async () => { throw new Error('403 Admin only'); });

        const code = await main(ENABLED_ENV, logger, { session, scheduler: mkScheduler(), llmClient: {} });

        expect(code).toBe(1);
        expect(errs.join()).toMatch(/could not fetch the roster.*403/);
    });

    it('fetches the roster over the API — never from a database', async () => {
        const session = mkSession();
        await main(ENABLED_ENV, capture().logger, {
            session, scheduler: mkScheduler(), llmClient: {},
        });
        expect(session.request).toHaveBeenCalledWith('/agents/admin');
    });
});

describe('helpers', () => {
    it('selects its roster using the SHARED account-kind constant', () => {
        expect(agentRosterFilter()).toEqual({ kind: ACCOUNT_KIND.AGENT });
        expect(agentRosterFilter().kind).toBe('agent');
    });

    it('degrades to "unknown" rather than "undefined undefined"', () => {
        expect(displayName(null)).toBe('unknown');
        expect(displayName({})).toBe('unknown');
        expect(displayName({ name: 'maya' })).toBe('maya');
    });
});

// The unit tests above drive main() directly; these prove the actual process
// wires it to stdout and terminates instead of hanging.
describe('worker as a real process', () => {
    const run = (env) =>
        execFileSync(process.execPath, [ENTRY], {
            env: { ...process.env, AGENTS_ENABLED: '', AGENT_EMAIL: '', AGENT_PASSWORD: '', ...env },
            encoding: 'utf8',
            timeout: 20_000,
        }).trim();

    it('prints "agents: disabled" and exits cleanly by default', () => {
        expect(run({})).toBe('agents: disabled');
    });

    it('enabled but unconfigured: exits non-zero and says which var is missing', () => {
        let status = 0, stderr = '';
        try {
            execFileSync(process.execPath, [ENTRY], {
                env: { ...process.env, AGENTS_ENABLED: 'true', AGENT_EMAIL: '', AGENT_PASSWORD: '' },
                encoding: 'utf8',
                timeout: 20_000,
            });
        } catch (err) {
            status = err.status;
            stderr = String(err.stderr || '');
        }
        expect(status).toBe(1);
        expect(stderr).toMatch(/AGENT_EMAIL/);
    });
});
