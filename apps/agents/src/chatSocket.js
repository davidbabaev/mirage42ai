const { io } = require('socket.io-client');

/**
 * The agent's chat connection — the SAME socket a human's browser uses.
 *
 * There is no HTTP endpoint for sending a plain-text DM: `send-message` over
 * socket.io is the path, and giving the runtime a private HTTP send route would
 * have broken "agents are users" (master-plan §3) for the one feature where
 * being indistinguishable matters most. It also gives inbound DMs in real time,
 * which is what §6's "near-time reply path" needs — polling GET /chats on a
 * 15-minute heartbeat would make every reply at least 15 minutes late.
 *
 * BOTH HALVES OF TASK B ARE IMPLEMENTED HERE, because this is the exact
 * component that failed:
 *
 *  1. AUTH IS A CALLBACK, not a static object. Every reconnect re-reads the
 *     CURRENT token. A static token captured at construction is what made the
 *     original bug permanent — the socket retried forever with a dead token.
 *  2. SENDS USE AN ACK WITH A TIMEOUT. socket.io SILENTLY BUFFERS an emit on a
 *     disconnected client: no throw, no error event, the message simply sits in
 *     a client-side buffer forever looking sent. For an agent that is worse
 *     than an error — it would record "I replied" in memory when it did not.
 */

const SEND_TIMEOUT_MS = 10_000;

/** The handshake failures that mean "your token is stale", not "the server is down". */
const isAuthError = (message = '') =>
    /auth|token|unauthor|jwt/i.test(String(message));

class AgentChatSocket {
    /**
     * @param {object} opts
     * @param {object} opts.session    an AgentSession — supplies the token AND the refresh
     * @param {function} [opts.ioImpl] injectable for tests
     */
    constructor({ session, baseUrl, ioImpl = io, logger = console } = {}) {
        if (!session) throw new Error('AgentChatSocket: a session is required');
        this.session = session;
        this.baseUrl = (baseUrl || session.baseUrl || '').replace(/\/+$/, '');
        this.ioImpl = ioImpl;
        this.logger = logger;
        this.socket = null;
        this.triedRefresh = false;
        this.handlers = new Set();
        this.stats = { connects: 0, authRefreshes: 0, sends: 0, sendFailures: 0 };
    }

    connect() {
        if (this.socket) return this.socket;

        this.socket = this.ioImpl(this.baseUrl, {
            // A CALLBACK, not `auth: { token }`. Every reconnect attempt asks
            // for the token that is current NOW. This one line is the first
            // half of the TASK B fix.
            auth: (cb) => cb({ token: this.session.token }),
        });

        this.socket.on('connect', () => {
            this.triedRefresh = false;
            this.stats.connects += 1;
        });

        this.socket.on('connect_error', async (error) => {
            const message = error?.message || '';

            // The access token expired. HTTP self-heals on a 401, but a socket
            // handshake is simply REFUSED — there is no 401 to react to, and it
            // would retry with the same dead token indefinitely.
            if (isAuthError(message) && !this.triedRefresh) {
                this.triedRefresh = true;
                try {
                    await this.session.refresh();
                    this.stats.authRefreshes += 1;
                    this.socket?.connect();
                    return;
                } catch {
                    try {
                        // Refresh cookie gone or rotated away — fall back to a
                        // full re-login, same ladder as the HTTP session.
                        await this.session.start();
                        this.stats.authRefreshes += 1;
                        this.socket?.connect();
                        return;
                    } catch (err) {
                        this.logger.error?.(`agents: chat socket cannot authenticate — ${err.message}`);
                    }
                }
            }
        });

        // Inbound DMs arrive here in real time.
        this.socket.on('receive-message', (message) => {
            for (const handler of this.handlers) {
                try {
                    handler(message);
                } catch (err) {
                    this.logger.error?.(`agents: DM handler threw — ${err.message}`);
                }
            }
        });

        return this.socket;
    }

    /** Registers a callback for inbound messages. Returns an unsubscribe fn. */
    onMessage(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    /**
     * Sends a DM and WAITS for the server to confirm it.
     *
     * The ack + timeout is the second half of the TASK B fix. Without it a send
     * on a disconnected socket resolves as if it worked, and the agent would
     * write "I replied to David" into its memory having said nothing.
     */
    async sendMessage({ toUser, text }) {
        if (!this.socket) throw new Error('sendMessage: socket not connected');
        if (!toUser) throw new Error('sendMessage: toUser is required');
        if (!text) throw new Error('sendMessage: text is required');

        const ack = await new Promise((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                resolve({ error: `send timed out after ${SEND_TIMEOUT_MS}ms` });
            }, SEND_TIMEOUT_MS);

            this.socket.emit('send-message', { toUser, text }, (response) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(response || { error: 'no acknowledgement from server' });
            });
        });

        if (!ack || ack.error) {
            this.stats.sendFailures += 1;
            throw new Error(`sendMessage failed: ${ack?.error || 'unknown error'}`);
        }

        this.stats.sends += 1;
        return ack.message;
    }

    disconnect() {
        this.socket?.disconnect?.();
        this.socket = null;
        this.handlers.clear();
    }
}

module.exports = { AgentChatSocket, isAuthError, SEND_TIMEOUT_MS };
