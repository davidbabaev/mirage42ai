import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';

// TASK B, half 2 — THE SILENCE.
//
// A text DM is a bare `getSocket().emit('send-message', message)`: no ack, no
// connectivity guard. socket.io SILENTLY BUFFERS an emit on a disconnected client —
// the event never reaches the server, and nothing throws. So when the socket is
// stuck in a refused-reconnect loop (expired token), the user types a message,
// presses send, the bubble does nothing, and they are told NOTHING.
//
// The app already renders a Snackbar bound to `sendError` (ChatPage +
// DockedChatWindow) — the media-upload path feeds it. The text path never did.
//
// A message that does not reach the server must be reported. That is the fix.

let socketConnected = false;
const emit = vi.fn();
const fakeSocket = {
    get connected() { return socketConnected; },
    emit,
    // The real client sends with an ack + timeout: socket.timeout(ms).emit(evt, msg, cb).
    timeout: () => ({ emit }),
    on: vi.fn(),
    off: vi.fn(),
};

vi.mock('../src/services/socketService', () => ({
    getSocket: () => fakeSocket,
    connectSocket: () => fakeSocket,
    disconnectSocket: () => {},
}));
vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true }),
}));
vi.mock('../src/services/apiService', () => ({
    getSingleChatMessages: vi.fn().mockResolvedValue({ messages: [], nextCursor: null }),
    uploadChatMedia: vi.fn(),
}));

import useChat from '../src/hooks/useChat';

function Harness() {
    const { handleSendNewMessage, sendError } = useChat('conv1', vi.fn(), vi.fn());
    return (
        <div>
            <span data-testid="error">{sendError || 'none'}</span>
            <button
                data-testid="send"
                onClick={() => handleSendNewMessage({ toUser: 'them', text: 'hello?' })}
            >send</button>
        </div>
    );
}

beforeEach(() => { emit.mockClear(); socketConnected = false; });
afterEach(() => { cleanup(); });

describe('a text DM that cannot reach the server is reported, not swallowed', () => {
    it('surfaces an error when the socket is disconnected', async () => {
        socketConnected = false;   // the refused-reconnect state after token expiry

        render(<Harness />);
        await act(async () => { screen.getByTestId('send').click(); });

        // The whole bug: today this emits into a buffer and says nothing.
        await waitFor(() =>
            expect(screen.getByTestId('error')).not.toHaveTextContent('none')
        );
    });

    it('still sends normally when the socket IS connected', async () => {
        socketConnected = true;

        render(<Harness />);
        await act(async () => { screen.getByTestId('send').click(); });

        expect(emit).toHaveBeenCalled();
        expect(emit.mock.calls[0][0]).toBe('send-message');
        expect(screen.getByTestId('error')).toHaveTextContent('none');
    });
});
