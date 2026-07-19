// Token lifecycle — the TASK B failure class.
//
// TASK B was not "a token expired". Tokens expiring is normal. It was that
// NOTHING NOTICED: the client held a credential that had quietly stopped
// working and the failure surfaced as silence. These tests therefore assert on
// RECOVERY, not on the absence of an error — a session that silently stops
// doing anything would pass a weaker test suite perfectly.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { AgentSession } = requireFromHere('../src/session.js');

const BASE = { baseUrl: 'http://api.test:8181', email: 'a@b.c', password: 'pw' };

const jsonRes = (body, { status = 200, setCookie } = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
        getSetCookie: () => (setCookie ? [setCookie] : []),
        get: (k) => (k.toLowerCase() === 'set-cookie' ? setCookie ?? null : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
});

const okLogin = (token = 'tok-1', cookie = 'rt-1') =>
    vi.fn(async () => ({
        token,
        user: { _id: 'u1', name: 'maya', lastName: 'ben-ari' },
        refreshCookie: cookie,
    }));

const startSession = async (fetchImpl, loginImpl = okLogin()) => {
    const s = new AgentSession({
        ...BASE, fetchImpl, loginImpl,
        logger: { log: () => {} },
    });
    await s.start();
    return s;
};

describe('AgentSession — start', () => {
    it('captures the token and the rotating refresh cookie', async () => {
        const s = await startSession(vi.fn(), okLogin('tok-1', 'rt-1'));
        expect(s.token).toBe('tok-1');
        expect(s.refreshCookie).toBe('rt-1');
        expect(s.user.name).toBe('maya');
    });

    it('refuses to make a request before start()', async () => {
        const s = new AgentSession({ ...BASE, fetchImpl: vi.fn() });
        await expect(s.request('/cards/feed')).rejects.toThrow(/not started/);
    });
});

describe('AgentSession — the expiry it must survive', () => {
    it('a 401 mid-run triggers refresh and REPLAYS the request', async () => {
        let calls = 0;
        const fetchImpl = vi.fn(async (url, init) => {
            if (url.endsWith('/auth/refresh')) {
                return jsonRes({ token: 'tok-2' }, { setCookie: 'refresh-token=rt-2; Path=/auth; HttpOnly' });
            }
            calls += 1;
            // First call: the token has expired. Second: the fresh one works.
            if (calls === 1) return jsonRes('Auth token invalid', { status: 401 });
            expect(init.headers['auth-token']).toBe('tok-2');
            return jsonRes({ cards: [{ _id: 'c1' }] });
        });

        const s = await startSession(fetchImpl);
        const body = await s.request('/cards/feed');

        // The REAL assertion: the caller got its data, not an error.
        expect(body.cards).toHaveLength(1);
        expect(s.token).toBe('tok-2');
        expect(s.stats.refreshes).toBe(1);
        expect(s.stats.retries).toBe(1);
    });

    it('captures the ROTATED cookie — the next refresh must not reuse the old one', async () => {
        const seen = [];
        const fetchImpl = vi.fn(async (url, init) => {
            if (url.endsWith('/auth/refresh')) {
                seen.push(init.headers.Cookie);
                const n = seen.length + 1;
                return jsonRes({ token: `tok-${n}` }, { setCookie: `refresh-token=rt-${n}; Path=/auth` });
            }
            return jsonRes('expired', { status: 401 });
        });

        const s = await startSession(fetchImpl);
        await s.refresh();
        await s.refresh();

        expect(seen).toEqual(['refresh-token=rt-1', 'refresh-token=rt-2']);
    });

    it('falls back to a FULL re-login when the refresh token is dead', async () => {
        const loginImpl = okLogin('tok-fresh', 'rt-fresh');
        let apiCalls = 0;
        const fetchImpl = vi.fn(async (url, init) => {
            if (url.endsWith('/auth/refresh')) {
                return jsonRes('Invalid refresh token', { status: 401 });
            }
            apiCalls += 1;
            if (apiCalls === 1) return jsonRes('Auth token invalid', { status: 401 });
            expect(init.headers['auth-token']).toBe('tok-fresh');
            return jsonRes({ ok: true });
        });

        const s = await startSession(fetchImpl, loginImpl);
        const body = await s.request('/cards/feed');

        expect(body.ok).toBe(true);
        expect(s.stats.refreshFailures).toBe(1);
        expect(loginImpl).toHaveBeenCalledTimes(2); // initial + recovery
    });

    it('THROWS when it cannot authenticate at all — never continues degraded', async () => {
        const loginImpl = vi.fn()
            .mockResolvedValueOnce({ token: 'tok-1', user: {}, refreshCookie: 'rt-1' })
            .mockRejectedValueOnce(new Error('login: rejected with 401'));

        const fetchImpl = vi.fn(async (url) =>
            url.endsWith('/auth/refresh')
                ? jsonRes('nope', { status: 401 })
                : jsonRes('Auth token invalid', { status: 401 }));

        const s = await startSession(fetchImpl, loginImpl);
        await expect(s.request('/cards/feed')).rejects.toThrow(/401/);
    });

    it('does not retry twice — a persistent 401 surfaces rather than looping', async () => {
        let refreshCount = 0;
        const fetchImpl = vi.fn(async (url) => {
            if (url.endsWith('/auth/refresh')) {
                refreshCount += 1;
                return jsonRes({ token: `t${refreshCount}` }, { setCookie: `refresh-token=r${refreshCount}` });
            }
            return jsonRes('Auth token invalid', { status: 401 }); // never recovers
        });

        const s = await startSession(fetchImpl);
        await expect(s.request('/cards/feed')).rejects.toThrow(/401/);
        expect(refreshCount).toBe(1); // exactly one attempt, no infinite loop
    });
});

describe('AgentSession — single-flight refresh', () => {
    it('concurrent 401s share ONE refresh (rotation makes racing self-defeating)', async () => {
        let refreshCount = 0;
        const fetchImpl = vi.fn(async (url, init) => {
            if (url.endsWith('/auth/refresh')) {
                refreshCount += 1;
                await new Promise(r => setTimeout(r, 10)); // make the race real
                return jsonRes({ token: 'tok-2' }, { setCookie: 'refresh-token=rt-2' });
            }
            if (init.headers['auth-token'] === 'tok-1') {
                return jsonRes('Auth token invalid', { status: 401 });
            }
            return jsonRes({ ok: true });
        });

        const s = await startSession(fetchImpl);
        const results = await Promise.all([
            s.request('/a'), s.request('/b'), s.request('/c'),
        ]);

        expect(results.every(r => r.ok)).toBe(true);
        // Three simultaneous 401s, ONE refresh. Two rotations would have
        // invalidated each other and logged the agent out.
        expect(refreshCount).toBe(1);
    });
});

describe('AgentSession — ordinary requests', () => {
    it('sends the auth-token header and JSON-encodes a body', async () => {
        const fetchImpl = vi.fn(async () => jsonRes({ done: true }));
        const s = await startSession(fetchImpl);

        await s.request('/cards/x/comments', { method: 'PATCH', body: { commentText: 'hi' } });

        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('http://api.test:8181/cards/x/comments');
        expect(init.method).toBe('PATCH');
        expect(init.headers['auth-token']).toBe('tok-1');
        expect(init.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(init.body)).toEqual({ commentText: 'hi' });
    });

    it('does not force a Content-Type on FormData (multipart needs its boundary)', async () => {
        const fetchImpl = vi.fn(async () => jsonRes({ ok: true }));
        const s = await startSession(fetchImpl);

        const form = new FormData();
        form.append('content', 'hello');
        await s.request('/cards', { method: 'POST', body: form });

        const init = fetchImpl.mock.calls[0][1];
        expect(init.headers['Content-Type']).toBeUndefined();
        expect(init.body).toBe(form);
    });

    it('surfaces a non-401 failure with its status', async () => {
        const fetchImpl = vi.fn(async () => jsonRes('Too many', { status: 429 }));
        const s = await startSession(fetchImpl);
        await expect(s.request('/cards')).rejects.toMatchObject({ status: 429 });
    });
});
