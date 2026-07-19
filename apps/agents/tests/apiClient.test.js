// The agent's client for the PUBLIC API. These tests assert on the EXACT
// request it sends, because the whole premise is that an agent is
// indistinguishable from a human client — if this ever stopped being a plain
// POST /users/login, agents would have stopped being users.
//
// fetch is injected rather than mocked globally, so the request shape is
// observed directly instead of inferred.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { login, AgentAuthError } = requireFromHere('../src/apiClient.js');

const CREDS = {
    baseUrl: 'http://api.test:8181',
    email: 'maya.benari@agents.mirage42.ai',
    password: 'AgentSeed1!',
};

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

describe('login — the request it sends', () => {
    it('POSTs JSON credentials to /users/login on the configured host', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ token: 't', safeUser: { name: 'maya' } }));

        await login({ ...CREDS, fetchImpl });

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, opts] = fetchImpl.mock.calls[0];
        expect(url).toBe('http://api.test:8181/users/login');
        expect(opts.method).toBe('POST');
        expect(opts.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(opts.body)).toEqual({
            email: CREDS.email,
            password: CREDS.password,
        });
    });

    it('does not double up the slash when baseUrl has a trailing one', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ token: 't' }));
        await login({ ...CREDS, baseUrl: 'http://api.test:8181///', fetchImpl });
        expect(fetchImpl.mock.calls[0][0]).toBe('http://api.test:8181/users/login');
    });

    it('bounds the request with an abort signal (never hangs forever)', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ token: 't' }));
        await login({ ...CREDS, fetchImpl });
        expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('sends no auth header — it is ACQUIRING a token, not using one', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse({ token: 't' }));
        await login({ ...CREDS, fetchImpl });
        const headers = fetchImpl.mock.calls[0][1].headers;
        expect(headers['auth-token']).toBeUndefined();
        expect(headers.Authorization).toBeUndefined();
    });
});

describe('login — what it returns', () => {
    it('returns the token and the user on success', async () => {
        const fetchImpl = async () => jsonResponse({
            token: 'jwt.abc.def',
            safeUser: { _id: 'u1', name: 'maya', lastName: 'ben-ari', kind: 'agent' },
        });

        const result = await login({ ...CREDS, fetchImpl });

        expect(result.token).toBe('jwt.abc.def');
        expect(result.user.name).toBe('maya');
    });

    it('tolerates a missing safeUser rather than crashing', async () => {
        const fetchImpl = async () => jsonResponse({ token: 'jwt.abc.def' });
        const result = await login({ ...CREDS, fetchImpl });
        expect(result.user).toBeNull();
    });
});

describe('login — failure modes', () => {
    it.each([
        ['baseUrl', { baseUrl: '' }],
        ['email', { email: '' }],
        ['password', { password: '' }],
    ])('refuses to send a request with no %s', async (field, override) => {
        const fetchImpl = vi.fn();
        await expect(login({ ...CREDS, ...override, fetchImpl })).rejects.toThrow(
            new RegExp(field)
        );
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('surfaces the HTTP status on a rejected login', async () => {
        const fetchImpl = async () => ({
            ok: false,
            status: 401,
            text: async () => 'Invalid email or password',
        });

        await expect(login({ ...CREDS, fetchImpl })).rejects.toMatchObject({
            name: 'AgentAuthError',
            status: 401,
        });
    });

    it('distinguishes a rate limit (429) from bad credentials (401)', async () => {
        const fetchImpl = async () => ({ ok: false, status: 429, text: async () => 'Too many' });
        await expect(login({ ...CREDS, fetchImpl })).rejects.toMatchObject({ status: 429 });
    });

    it('reports an unreachable API without leaking the request body', async () => {
        const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };

        const err = await login({ ...CREDS, fetchImpl }).catch((e) => e);

        expect(err).toBeInstanceOf(AgentAuthError);
        expect(err.message).toMatch(/could not reach the API/);
        // The password must never appear in an error message or a log line.
        expect(err.message).not.toContain(CREDS.password);
    });

    it('rejects a 200 that carries no token instead of passing undefined along', async () => {
        const fetchImpl = async () => jsonResponse({ safeUser: { name: 'maya' } });
        await expect(login({ ...CREDS, fetchImpl })).rejects.toThrow(/no token/);
    });

    it('rejects a non-JSON body', async () => {
        const fetchImpl = async () => ({
            ok: true,
            status: 200,
            json: async () => { throw new Error('Unexpected token <'); },
        });
        await expect(login({ ...CREDS, fetchImpl })).rejects.toThrow(/non-JSON/);
    });

    it('caps an oversized error body rather than splicing it whole into a message', async () => {
        const fetchImpl = async () => ({
            ok: false,
            status: 500,
            text: async () => 'x'.repeat(10_000),
        });

        const err = await login({ ...CREDS, fetchImpl }).catch((e) => e);
        expect(err.message.length).toBeLessThan(400);
    });
});
