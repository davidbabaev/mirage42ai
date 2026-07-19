// The agent's chat socket. This is the component TASK B broke, so both halves
// of that bug are pinned here:
//   1. a socket that never learned about a refreshed token
//   2. socket.io SILENTLY BUFFERING an emit on a disconnected client, so a
//      message looked sent and never was
//
// The second is the dangerous one for an agent: a silently buffered send would
// make it write "I replied to David" into its memory having said nothing.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { AgentChatSocket, isAuthError } = requireFromHere('../src/chatSocket.js');

/** A fake socket.io client that lets a test drive handshake + ack behaviour. */
const fakeSocket = ({ ackWith, neverAck = false } = {}) => {
    const listeners = new Map();
    return {
        listeners,
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        on(event, fn) { listeners.set(event, fn); return this; },
        emit: vi.fn((event, payload, ack) => {
            if (neverAck) return;              // simulates a buffered send
            if (typeof ack === 'function') ack(ackWith);
        }),
        /** Test helper: fire a server-side event at the client. */
        fire(event, arg) { return listeners.get(event)?.(arg); },
    };
};

const mkSession = (over = {}) => ({
    token: 'tok-1',
    baseUrl: 'http://api.test:8181',
    refresh: vi.fn(async function () { this.token = 'tok-2'; return 'tok-2'; }),
    start: vi.fn(async function () { this.token = 'tok-fresh'; }),
    ...over,
});

const mkSocket = (opts = {}, sessionOver = {}) => {
    const socket = fakeSocket(opts);
    const session = mkSession(sessionOver);
    const client = new AgentChatSocket({
        session, ioImpl: () => socket, logger: { error: () => {} },
    });
    client.connect();
    return { client, socket, session };
};

describe('auth is a CALLBACK, not a captured token (TASK B, half one)', () => {
    it('passes a function so every reconnect re-reads the CURRENT token', () => {
        const socket = fakeSocket();
        const session = mkSession();
        let captured;
        const client = new AgentChatSocket({
            session,
            ioImpl: (url, opts) => { captured = opts; return socket; },
        });
        client.connect();

        expect(typeof captured.auth).toBe('function');

        // The token the callback yields tracks the session, not construction.
        let handed;
        captured.auth((v) => { handed = v; });
        expect(handed.token).toBe('tok-1');

        session.token = 'tok-rotated';
        captured.auth((v) => { handed = v; });
        expect(handed.token).toBe('tok-rotated');
    });

    it('a static auth object would have frozen the dead token — it is not one', () => {
        const socket = fakeSocket();
        let captured;
        new AgentChatSocket({ session: mkSession(), ioImpl: (u, o) => { captured = o; return socket; } })
            .connect();
        expect(captured.auth).not.toEqual(expect.objectContaining({ token: expect.any(String) }));
    });
});

describe('a refused handshake triggers a refresh and reconnect', () => {
    it.each(['Auth token invalid', 'jwt expired', 'Unauthorized'])(
        'treats "%s" as an auth failure',
        (msg) => expect(isAuthError(msg)).toBe(true)
    );

    it('does not treat a network failure as an auth failure', () => {
        expect(isAuthError('xhr poll error')).toBe(false);
        expect(isAuthError('ECONNREFUSED')).toBe(false);
    });

    it('refreshes the token then reconnects', async () => {
        const { socket, session } = mkSocket();

        await socket.fire('connect_error', new Error('Auth token invalid'));

        expect(session.refresh).toHaveBeenCalledTimes(1);
        expect(socket.connect).toHaveBeenCalledTimes(1);
        expect(session.token).toBe('tok-2');
    });

    it('falls back to a full re-login when refresh fails', async () => {
        const { socket, session } = mkSocket({}, {
            refresh: vi.fn(async () => { throw new Error('refresh rejected'); }),
        });

        await socket.fire('connect_error', new Error('jwt expired'));

        expect(session.start).toHaveBeenCalledTimes(1);
        expect(socket.connect).toHaveBeenCalledTimes(1);
    });

    it('does not loop forever on a persistent auth failure', async () => {
        const { socket, session } = mkSocket();

        await socket.fire('connect_error', new Error('Auth token invalid'));
        await socket.fire('connect_error', new Error('Auth token invalid'));
        await socket.fire('connect_error', new Error('Auth token invalid'));

        expect(session.refresh).toHaveBeenCalledTimes(1); // guarded
    });

    it('re-arms the guard after a successful connect, so a LATER expiry heals too', async () => {
        const { socket, session } = mkSocket();

        await socket.fire('connect_error', new Error('Auth token invalid'));
        expect(session.refresh).toHaveBeenCalledTimes(1);

        socket.fire('connect');                       // reconnected
        await socket.fire('connect_error', new Error('Auth token invalid')); // hours later

        // Without re-arming, a long-running agent heals exactly once and then
        // goes permanently silent — which is TASK B all over again.
        expect(session.refresh).toHaveBeenCalledTimes(2);
    });

    it('ignores a non-auth connect_error', async () => {
        const { socket, session } = mkSocket();
        await socket.fire('connect_error', new Error('xhr poll error'));
        expect(session.refresh).not.toHaveBeenCalled();
    });
});

describe('sends are ACKNOWLEDGED, never fire-and-forget (TASK B, half two)', () => {
    it('resolves with the saved message when the server acks ok', async () => {
        const { client } = mkSocket({ ackWith: { ok: true, message: { _id: 'm1' } } });

        const sent = await client.sendMessage({ toUser: 'u2', text: 'hello' });

        expect(sent._id).toBe('m1');
        expect(client.stats.sends).toBe(1);
    });

    it('emits the exact payload the server expects', async () => {
        const { client, socket } = mkSocket({ ackWith: { ok: true, message: {} } });
        await client.sendMessage({ toUser: 'u2', text: 'hello' });

        const [event, payload] = socket.emit.mock.calls[0];
        expect(event).toBe('send-message');
        expect(payload).toEqual({ toUser: 'u2', text: 'hello' });
    });

    it('THROWS when the server reports an error', async () => {
        const { client } = mkSocket({ ackWith: { error: 'You are blocked' } });
        await expect(client.sendMessage({ toUser: 'u2', text: 'x' })).rejects.toThrow(/blocked/);
        expect(client.stats.sendFailures).toBe(1);
    });

    it('THROWS on a silently buffered send instead of resolving', async () => {
        // The TASK B failure mode: socket.io buffers the emit on a
        // disconnected client and never acks. Without the timeout this would
        // hang forever or, worse, look successful.
        vi.useFakeTimers();
        const { client } = mkSocket({ neverAck: true });

        const pending = client.sendMessage({ toUser: 'u2', text: 'x' });
        const assertion = expect(pending).rejects.toThrow(/timed out/);
        await vi.advanceTimersByTimeAsync(11_000);
        await assertion;

        vi.useRealTimers();
    });

    it('rejects an incomplete send rather than emitting junk', async () => {
        const { client } = mkSocket({ ackWith: { ok: true, message: {} } });
        await expect(client.sendMessage({ text: 'x' })).rejects.toThrow(/toUser/);
        await expect(client.sendMessage({ toUser: 'u2' })).rejects.toThrow(/text/);
    });
});

describe('inbound messages', () => {
    it('hands receive-message to every registered handler', () => {
        const { client, socket } = mkSocket();
        const seen = [];
        client.onMessage((m) => seen.push(m));
        client.onMessage((m) => seen.push({ ...m, second: true }));

        socket.fire('receive-message', { _id: 'm1', text: 'hi' });

        expect(seen).toHaveLength(2);
        expect(seen[0].text).toBe('hi');
    });

    it('one throwing handler does not stop the others', () => {
        const { client, socket } = mkSocket();
        const seen = [];
        client.onMessage(() => { throw new Error('boom'); });
        client.onMessage((m) => seen.push(m));

        expect(() => socket.fire('receive-message', { _id: 'm1' })).not.toThrow();
        expect(seen).toHaveLength(1);
    });

    it('unsubscribes cleanly', () => {
        const { client, socket } = mkSocket();
        const seen = [];
        const off = client.onMessage((m) => seen.push(m));

        socket.fire('receive-message', { _id: 'a' });
        off();
        socket.fire('receive-message', { _id: 'b' });

        expect(seen.map(m => m._id)).toEqual(['a']);
    });
});
