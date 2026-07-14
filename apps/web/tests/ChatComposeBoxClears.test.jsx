import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';

// Regression for the "wrong-recipient draft" bug.
//
// ChatPage keeps the compose-box draft in useState(messageText).  When the
// active conversation changes the draft MUST be cleared — otherwise a message
// typed to Alice can sit in the box and be sent to Bob.
//
// There are three code paths that switch conversations:
//   1. handleSelectChat   — click a row in the sidebar           → cleared ✓
//   2. deep-link, EXISTING conversation found in the list        → cleared ✓
//   3. deep-link, NO existing conversation → getSingleUser()     → was NOT cleared ✗
//
// Path 3 called setSelectedChat() but forgot setMessageText('').  The fix adds
// that call inside the getSingleUser .then() before setSelectedChat.

// ---- Minimal fake socket (socketService is imported by ChatPage transitively) ----
const fakeSocket = {
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    timeout: () => ({ emit: vi.fn() }),
};

vi.mock('../src/services/socketService', () => ({
    getSocket: () => fakeSocket,
    connectSocket: () => fakeSocket,
    disconnectSocket: () => {},
}));

vi.mock('../src/providers/authContext', () => ({
    useAuth: () => ({ user: { _id: 'me', name: 'Me' }, isLoggedIn: true }),
}));

// getSingleUser is the key API call for path 3 — resolves Bob so the test can
// observe whether the compose box was cleared before his chat was selected.
vi.mock('../src/services/apiService', () => ({
    getSingleUser: vi.fn().mockResolvedValue({ _id: 'bob', name: 'Bob', profilePicture: '' }),
    getSingleChatMessages: vi.fn().mockResolvedValue({ messages: [], nextCursor: null }),
    markChatRead: vi.fn().mockResolvedValue({}),
}));

// Alice has an existing conversation; Bob does NOT — forces the getSingleUser path.
vi.mock('../src/providers/chatContext', () => ({
    useChatList: () => ({
        conversations: [{
            _id: 'alice-conv',
            fromUser: 'me',
            toUser: 'alice',
            unreadCount: 0,
            lastMessage: null,
            otherUser: { _id: 'alice', name: 'Alice', profilePicture: '' },
        }],
        hasMore: false,
        loadingMore: false,
        loadMore: vi.fn(),
        markRead: vi.fn(),
        deleteConversation: vi.fn(),
        setActiveConversationId: vi.fn(),
    }),
}));

vi.mock('../src/providers/uiContext', () => ({
    useUI: () => ({ setIsChatOpen: vi.fn() }),
}));

vi.mock('../src/providers/usersContext', () => ({
    useUsersProvider: () => ({ users: [] }),
}));

vi.mock('../src/hooks/useChat', () => ({
    default: () => ({
        handleOpenConversation: vi.fn(),
        handleSendNewMessage: vi.fn(),
        chatMessages: [],
        loadOlderMessages: vi.fn(),
        hasOlderMessages: false,
        loadingOlder: false,
        sendError: null,
        clearSendError: vi.fn(),
    }),
}));

vi.mock('../src/hooks/useBlockUser', () => ({
    default: () => ({ toggleBlock: vi.fn(), isBlockedByMe: () => false }),
}));

// ConversationList: single button so the test can simulate opening Alice's chat.
vi.mock('../src/pages/chat/components/ConversationList', () => ({
    default: ({ onSelectChat }) => (
        <button
            data-testid="open-alice"
            onClick={() => onSelectChat(
                { _id: 'alice-conv', fromUser: 'me', toUser: 'alice', unreadCount: 0, lastMessage: null },
                { _id: 'alice', name: 'Alice', profilePicture: '' },
            )}
        >
            open alice
        </button>
    ),
}));

// MessageInput is the compose box — wire a real <input> to the messageText /
// setMessageText props so the test can set the draft and inspect its value.
vi.mock('../src/pages/chat/components/MessageInput', () => ({
    default: ({ messageText, setMessageText }) => (
        <input
            data-testid="compose"
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
        />
    ),
}));

vi.mock('../src/pages/chat/components/ChatHeader', () => ({ default: () => <div /> }));
vi.mock('../src/pages/chat/components/MessageList', () => ({ default: () => <div /> }));
vi.mock('../src/pages/chat/components/ScrollToBottomButton', () => ({ default: () => <div /> }));
vi.mock('../src/pages/chat/components/ChatEmptyState', () => ({ default: () => <div /> }));

import ChatPage from '../src/pages/chat/ChatPage';

// Harness wraps ChatPage and provides a button to inject the ?to search param,
// exactly as the browser would when the user follows a deep-link to a DM.
function Harness() {
    const [, setParams] = useSearchParams();
    return (
        <>
            <button data-testid="go-bob" onClick={() => setParams({ to: 'bob' })}>
                go bob
            </button>
            <ChatPage />
        </>
    );
}

beforeEach(() => { localStorage.setItem('auth-token', 'test-token'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('compose box is cleared on every path that switches the active conversation', () => {
    it('clears the draft when deep-linking to a user with no existing conversation (getSingleUser path)', async () => {
        render(
            <MemoryRouter initialEntries={['/chat']}>
                <Harness />
            </MemoryRouter>
        );

        // Open Alice's conversation so the compose box is visible.
        fireEvent.click(screen.getByTestId('open-alice'));

        // Type a draft addressed to Alice.
        fireEvent.change(screen.getByTestId('compose'), { target: { value: "hey Alice, how are you?" } });
        expect(screen.getByTestId('compose')).toHaveValue("hey Alice, how are you?");

        // Navigate to ?to=bob.  Bob has no existing conversation, so ChatPage
        // calls getSingleUser('bob') and then setSelectedChat({...bob}).
        // Without the fix, setMessageText('') was missing from that .then()
        // callback, leaving Alice's draft sitting in Bob's compose box.
        fireEvent.click(screen.getByTestId('go-bob'));

        // After getSingleUser resolves the compose box must be empty.
        await waitFor(() => expect(screen.getByTestId('compose')).toHaveValue(''));
    });
});
