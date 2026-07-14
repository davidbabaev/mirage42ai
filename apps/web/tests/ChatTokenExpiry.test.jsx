import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, waitFor } from '@testing-library/react';

// TASK B — "after a long session the user can't send DMs; sends silently fail until
// logout + relogin."
//
// Two defects, both reproduced here:
//
//  1. THE CAUSE. The access token lives 15 minutes. The socket authenticates at
//     CONNECT time. If the socket drops and reconnects after the token has expired
//     (and no HTTP request has happened to refresh it), the server refuses the
//     handshake — and the client just retries forever with the same dead token,
//     logging to the console. Nothing ever refreshes it. Only logout+login, which
//     mints a new token over HTTP and builds a new socket, breaks the cycle.
//
//  2. THE SILENCE. A text DM is a bare `socket.emit(...)` with no ack and no
//     connectivity guard. Emitting on a disconnected socket.io client SILENTLY
//     BUFFERS the event — it never reaches the server, and no error is raised. The
//     app already has the UI to show a send failure (a Snackbar bound to sendError);
//     nothing was ever feeding it.

// ── 1. socketService must refresh the token and retry on an auth failure ─────────

const mockRefresh = vi.fn();
vi.mock('../src/services/apiService', () => ({
    refreshAccessToken: (...a) => mockRefresh(...a),
}));

const handlers = {};
const fakeSocket = {
    connected: false,
    on: vi.fn((evt, cb) => { handlers[evt] = cb; }),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
};
vi.mock('socket.io-client', () => ({
    io: vi.fn(() => fakeSocket),
}));

import { connectSocket, disconnectSocket } from '../src/services/socketService';

beforeEach(() => {
    localStorage.setItem('auth-token', 'expired-token');
    mockRefresh.mockReset();
    fakeSocket.connect.mockClear();
    for (const k of Object.keys(handlers)) delete handlers[k];
});
afterEach(() => { disconnectSocket(); cleanup(); localStorage.clear(); });

describe('socket auth survives an expired access token', () => {
    it('refreshes the token and reconnects when the handshake is refused', async () => {
        mockRefresh.mockResolvedValue('fresh-token');

        connectSocket();

        // The server refuses the reconnect because the token expired mid-session.
        await act(async () => {
            await handlers['connect_error']?.(new Error('Invalid token'));
        });

        // It must not just console.log and retry forever with the same dead token:
        // it has to go get a new one, then reconnect.
        expect(mockRefresh).toHaveBeenCalled();
        await waitFor(() => expect(fakeSocket.connect).toHaveBeenCalled());
    });

    it('does not try to refresh on a NON-auth connect error (e.g. server down)', async () => {
        connectSocket();

        await act(async () => {
            await handlers['connect_error']?.(new Error('xhr poll error'));
        });

        // A network blip is not an auth problem — refreshing would be pointless
        // churn, and socket.io already retries on its own.
        expect(mockRefresh).not.toHaveBeenCalled();
    });
});
