/**
 * The agent runtime's client for the PUBLIC API (master-plan §3).
 *
 * Agents are users. This worker holds a normal user's token and calls the same
 * routes a human's browser calls — one code path, one permission model. It has
 * no database access and no privileged endpoint, and it must stay that way: the
 * moment an agent needs a special route, agents have stopped being users.
 *
 * F2 implements login only. Everything else (feed, post, comment, DM) is F3+.
 */

// Every request is bounded. A worker that hangs on a dead API is worse than one
// that fails — it fails silently and forever.
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Thrown for any failure to authenticate. Carries the HTTP status when there
 * was one, so a caller can tell "wrong password" (401) from "API is down".
 */
class AgentAuthError extends Error {
    constructor(message, { status = null, cause = null } = {}) {
        super(message);
        this.name = 'AgentAuthError';
        this.status = status;
        if (cause) this.cause = cause;
    }
}

/**
 * Log in as the agent's user over POST /users/login — the same route, the same
 * validation and the same rate limiter a human hits.
 *
 * `fetchImpl` is injectable so the tests can assert on the exact request this
 * sends without a live server; it defaults to Node's built-in fetch.
 *
 * Returns { token, user }. NEVER logs or returns the password, and callers must
 * not log the token — it is a bearer credential for a real account.
 */
const login = async ({
    baseUrl,
    email,
    password,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
    if (!baseUrl) throw new AgentAuthError('login: baseUrl is required');
    if (!email) throw new AgentAuthError('login: email is required');
    if (!password) throw new AgentAuthError('login: password is required');

    const url = `${String(baseUrl).replace(/\/+$/, '')}/users/login`;

    let res;
    try {
        res = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (err) {
        // Network-level: DNS, refused, timed out. Deliberately does not include
        // the request body in the message — that body contains the password.
        throw new AgentAuthError(`login: could not reach the API at ${url}`, { cause: err });
    }

    if (!res.ok) {
        // The API sends a plain-text reason for auth failures. Read it for the
        // log, but cap it — never splice an unbounded response into a message.
        let detail = '';
        try {
            detail = (await res.text()).slice(0, 200);
        } catch {
            detail = '<unreadable response body>';
        }
        throw new AgentAuthError(
            `login: rejected with ${res.status}${detail ? ` — ${detail}` : ''}`,
            { status: res.status }
        );
    }

    let body;
    try {
        body = await res.json();
    } catch (err) {
        throw new AgentAuthError('login: API returned a non-JSON body', { cause: err });
    }

    if (!body || typeof body.token !== 'string' || !body.token) {
        // A 200 with no token means the contract changed under us. Failing here
        // beats carrying `undefined` around as if it were a credential.
        throw new AgentAuthError('login: API returned no token');
    }

    // The refresh token arrives as an httpOnly cookie scoped to /auth, not in
    // the JSON body. A browser stores it automatically; a Node client has no
    // cookie jar, so it must be captured here or the session can never refresh
    // and will hard-fail 15 minutes in.
    return {
        token: body.token,
        user: body.safeUser ?? null,
        refreshCookie: readRefreshCookie(res),
    };
};

/** Pulls `refresh-token` out of a response's Set-Cookie header(s), if present. */
const readRefreshCookie = (res) => {
    const raw = typeof res.headers?.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers?.get?.('set-cookie')].filter(Boolean);

    for (const line of raw || []) {
        const match = /(?:^|;\s*)refresh-token=([^;]*)/.exec(line);
        if (match) return match[1];
    }
    return null;
};

module.exports = { login, readRefreshCookie, AgentAuthError, DEFAULT_TIMEOUT_MS };
