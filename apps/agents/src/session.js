const { login, AgentAuthError } = require('./apiClient');

/**
 * An authenticated, self-healing session against the public API.
 *
 * THIS IS THE TASK B FAILURE CLASS, and it is the reason this module exists at
 * all. The DM socket bug was not that a token expired — tokens are supposed to
 * expire. It was that nothing noticed: the client held a credential that had
 * quietly stopped working, and the failure surfaced as silence rather than as
 * an error. A worker that runs for days on a 15-minute access token walks into
 * exactly that, so expiry is handled as a NORMAL event on the happy path, not
 * as an error case bolted on afterwards.
 *
 * How it heals, in order:
 *   1. Any 401 triggers ONE refresh via POST /auth/refresh, then the original
 *      request is replayed.
 *   2. If the refresh itself fails (refresh token rotated away, expired, or
 *      the server restarted), fall back to a full re-login with the
 *      credentials we still hold.
 *   3. If that also fails, throw. A worker that cannot authenticate must stop
 *      loudly — never continue in a degraded state.
 *
 * Refresh is SINGLE-FLIGHT: concurrent 401s share one in-flight refresh rather
 * than racing. The API rotates the refresh token on every use, so two parallel
 * refreshes would invalidate each other and the second would fail — turning a
 * recoverable expiry into a hard logout.
 */

const REFRESH_COOKIE = 'refresh-token';
const DEFAULT_TIMEOUT_MS = 10_000;

class AgentSession {
    /**
     * @param {object} opts
     * @param {string} opts.baseUrl      API base, e.g. http://localhost:8181
     * @param {string} opts.email        the agent account's email
     * @param {string} opts.password     the agent account's password
     * @param {function} [opts.fetchImpl] injectable for tests
     * @param {function} [opts.loginImpl] injectable for tests
     * @param {object} [opts.logger]
     */
    constructor({ baseUrl, email, password, fetchImpl, loginImpl, logger = console, timeoutMs } = {}) {
        if (!baseUrl) throw new AgentAuthError('AgentSession: baseUrl is required');
        this.baseUrl = String(baseUrl).replace(/\/+$/, '');
        this.email = email;
        this.password = password;
        this.fetchImpl = fetchImpl || globalThis.fetch;
        this.loginImpl = loginImpl || login;
        this.logger = logger;
        this.timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;

        this.token = null;
        this.user = null;
        this.refreshCookie = null;
        // Counters so a test — and an operator — can see that healing actually
        // happened rather than inferring it from the absence of a failure.
        this.stats = { logins: 0, refreshes: 0, refreshFailures: 0, retries: 0 };
        this._inFlightRefresh = null;
    }

    /** Extracts the rotating refresh cookie from a response, if present. */
    _captureRefreshCookie(res) {
        const raw = typeof res.headers?.getSetCookie === 'function'
            ? res.headers.getSetCookie()
            : [res.headers?.get?.('set-cookie')].filter(Boolean);

        for (const line of raw || []) {
            const match = /(?:^|;\s*)refresh-token=([^;]*)/.exec(line);
            if (match) this.refreshCookie = match[1];
        }
    }

    async start() {
        const result = await this.loginImpl({
            baseUrl: this.baseUrl,
            email: this.email,
            password: this.password,
            fetchImpl: this.fetchImpl,
            timeoutMs: this.timeoutMs,
        });
        this.token = result.token;
        this.user = result.user;
        if (result.refreshCookie) this.refreshCookie = result.refreshCookie;
        this.stats.logins += 1;
        return this;
    }

    /**
     * Exchanges the refresh cookie for a fresh access token. Single-flight: a
     * second caller during an in-flight refresh awaits the same promise.
     */
    async refresh() {
        if (this._inFlightRefresh) return this._inFlightRefresh;

        this._inFlightRefresh = (async () => {
            if (!this.refreshCookie) {
                throw new AgentAuthError('refresh: no refresh cookie held');
            }

            const res = await this.fetchImpl(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { Cookie: `${REFRESH_COOKIE}=${this.refreshCookie}` },
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (!res.ok) {
                throw new AgentAuthError(`refresh: rejected with ${res.status}`, { status: res.status });
            }

            const body = await res.json();
            if (!body || typeof body.token !== 'string' || !body.token) {
                throw new AgentAuthError('refresh: API returned no token');
            }

            // The API ROTATES the refresh token on every use — capturing the new
            // cookie is not optional. Miss it and the next refresh presents a
            // token the server has already retired.
            this._captureRefreshCookie(res);
            this.token = body.token;
            if (body.safeUser) this.user = body.safeUser;
            this.stats.refreshes += 1;
            return this.token;
        })();

        try {
            return await this._inFlightRefresh;
        } finally {
            this._inFlightRefresh = null;
        }
    }

    /**
     * Re-authenticates from scratch. The last line of defence when the refresh
     * token is gone — possible after a server restart or a long outage.
     */
    async _reLogin() {
        this.refreshCookie = null;
        await this.start();
        return this.token;
    }

    /**
     * An authenticated request that survives token expiry.
     *
     * `path` is API-relative ('/cards/feed'). Returns the parsed JSON body.
     */
    async request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
        if (!this.token) throw new AgentAuthError('request: session not started');

        const send = async () => {
            const init = {
                method,
                headers: { ...headers, 'auth-token': this.token },
                signal: AbortSignal.timeout(this.timeoutMs),
            };
            if (body !== undefined) {
                if (body instanceof FormData) {
                    init.body = body; // let fetch set the multipart boundary
                } else {
                    init.headers['Content-Type'] = 'application/json';
                    init.body = JSON.stringify(body);
                }
            }
            return this.fetchImpl(`${this.baseUrl}${path}`, init);
        };

        let res = await send();

        if (res.status === 401) {
            // Expected, roughly every 15 minutes. Not an error — a lifecycle event.
            this.stats.retries += 1;
            try {
                await this.refresh();
            } catch (err) {
                this.stats.refreshFailures += 1;
                this.logger.log?.(`agents: refresh failed (${err.message}) — re-authenticating`);
                await this._reLogin();
            }
            res = await send();
        }

        if (!res.ok) {
            let detail = '';
            try { detail = (await res.text()).slice(0, 200); } catch { detail = ''; }
            throw new AgentAuthError(
                `${method} ${path} failed with ${res.status}${detail ? ` — ${detail}` : ''}`,
                { status: res.status }
            );
        }

        if (raw) return res;
        if (res.status === 204) return null;
        try {
            return await res.json();
        } catch {
            return null;
        }
    }
}

module.exports = { AgentSession, REFRESH_COOKIE };
