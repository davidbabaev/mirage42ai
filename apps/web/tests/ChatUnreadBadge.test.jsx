import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Regression test for the "dead unread badge after opening a chat then leaving"
// bug. Root cause: ChatPage set ChatProvider's active-conversation id when a
// chat opened but never cleared it on unmount, so every later message for that
// conversation was treated as "active" (isActive=true) and never bumped unread.

// ---- A tiny fake socket so ChatProvider can subscribe; the test drives it. ----
const handlers = { 'receive-message': [], 'conversation-read': [], 'deleted-conversation': [] };
const fakeSocket = {
    connected: true,
    on: (ev, fn) => { (handlers[ev] ||= []).push(fn); },
    off: (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter(h => h !== fn); },
    emit: vi.fn(),
};
function emitReceive(msg) {
    act(() => { (handlers['receive-message'] || []).forEach(h => h(msg)); });
}

const CONV = { _id: 'conv1', fromUser: 'me', toUser: 'sarah', unreadCount: 0, lastMessage: null };

vi.mock('../src/services/socketService', () => ({
    getSocket: () => fakeSocket,
    connectSocket: () => fakeSocket,
    disconnectSocket: () => {},
}));
vi.mock('../src/services/apiService', () => ({
    // Paginated envelope: { conversations, nextCursor, totalUnread }. First page
    // carries the server-computed total; here one already-read conversation.
    getChats: vi.fn().mockResolvedValue({
        conversations: [
            { _id: 'conv1', fromUser: 'me', toUser: 'sarah', unreadCount: 0, lastMessage: null },
        ],
        nextCursor: null,
        totalUnread: 0,
    }),
    markChatRead: vi.fn().mockResolvedValue({}),
    deleteChat: vi.fn().mockResolvedValue({}),
}));
vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true }),
}));
vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({ users: [{ _id: 'sarah', name: 'Sarah', profilePicture: '' }] }),
}));
vi.mock('../src/providers/UIProvider', () => ({
    useUI: () => ({ setIsChatOpen: vi.fn() }),
}));
// useChat owns the open-thread socket wiring; stub it so this test only
// exercises ChatPage's active-id lifecycle against the real ChatProvider.
vi.mock('../src/hooks/useChat', () => ({
    default: () => ({
        handleOpenConversation: vi.fn(),
        handleSendNewMessage: vi.fn(),
        chatMessages: [],
        sendError: null,
        clearSendError: vi.fn(),
    }),
}));
// Stub the heavy presentational children. ConversationList exposes a button
// that opens the seeded conversation (mirrors a user clicking a chat row).
vi.mock('../src/pages/chat/components/ConversationList', () => ({
    default: ({ onSelectChat }) => (
        <button
            data-testid="open-chat"
            onClick={() => onSelectChat(
                { _id: 'conv1', fromUser: 'me', toUser: 'sarah', unreadCount: 0, lastMessage: null },
                { _id: 'sarah', name: 'Sarah' },
            )}
        >
            open
        </button>
    ),
}));
vi.mock('../src/pages/chat/components/ChatHeader', () => ({ default: () => <div /> }));
vi.mock('../src/pages/chat/components/MessageList', () => ({ default: () => <div /> }));
vi.mock('../src/pages/chat/components/MessageInput', () => ({ default: () => <div /> }));
vi.mock('../src/pages/chat/components/ScrollToBottomButton', () => ({ default: () => <div /> }));
vi.mock('../src/pages/chat/components/ChatEmptyState', () => ({ default: () => <div /> }));
// ChatPage now imports useBlockUser which transitively needs CardsProvider.
vi.mock('../src/hooks/useBlockUser', () => ({
    default: () => ({ toggleBlock: vi.fn(), isBlockedByMe: () => false }),
}));

import { ChatProvider, useChatList } from '../src/providers/ChatProvider';
import ChatPage from '../src/pages/chat/ChatPage';

function Harness() {
    const [onChatPage, setOnChatPage] = useState(true);
    const { totalUnread } = useChatList();
    return (
        <>
            <div data-testid="total">{totalUnread}</div>
            <button data-testid="leave" onClick={() => setOnChatPage(false)}>leave</button>
            {onChatPage && <ChatPage />}
        </>
    );
}

beforeEach(() => {
    Object.keys(handlers).forEach(k => { handlers[k] = []; });
    localStorage.setItem('auth-token', 'test-token');
});
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('chat unread badge — active id is cleared when leaving the chat page', () => {
    it('bumps unread for a message that arrives after opening a conversation then navigating away', async () => {
        render(
            <MemoryRouter>
                <ChatProvider><Harness /></ChatProvider>
            </MemoryRouter>
        );

        // conversations loaded from getChats
        await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('0'));

        // open the conversation (sets active id + marks read)
        fireEvent.click(screen.getByTestId('open-chat'));

        // while open, an incoming message must NOT bump (it's the active chat)
        emitReceive({ conversationId: 'conv1', userId: 'sarah', text: 'while open', createdAt: new Date().toISOString() });
        expect(screen.getByTestId('total')).toHaveTextContent('0');

        // navigate away from the chat page (ChatPage unmounts)
        fireEvent.click(screen.getByTestId('leave'));

        // a later message from the other user MUST bump the badge now
        emitReceive({ conversationId: 'conv1', userId: 'sarah', text: 'after leaving', createdAt: new Date().toISOString() });
        expect(screen.getByTestId('total')).toHaveTextContent('1');

        // and a second one bumps again
        emitReceive({ conversationId: 'conv1', userId: 'sarah', text: 'again', createdAt: new Date().toISOString() });
        expect(screen.getByTestId('total')).toHaveTextContent('2');
    });
});
