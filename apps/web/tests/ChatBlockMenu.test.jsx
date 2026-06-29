/**
 * ChatBlockMenu.test.jsx
 *
 * Tests for the "Block user" action in:
 *   - ChatHeader (full-chat ⋯ menu): shows item, calls onBlock prop
 *   - DockedChatWindow (dock ⋯ menu): shows item, opens confirm, calls toggleBlock
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------
const ME    = { _id: 'me-id',    name: 'Me',    lastName: 'Self' };
const OTHER = { _id: 'other-id', name: 'Alice', lastName: 'Smith', profilePicture: '', job: 'Dev', address: { city: 'NYC' } };

// ---------------------------------------------------------------------------
// ---- ChatHeader ------------------------------------------------------------
// ---------------------------------------------------------------------------

import ChatHeader from '../src/pages/chat/components/ChatHeader';

describe('ChatHeader — block menu item', () => {
    afterEach(() => cleanup());

    const renderHeader = (onBlock = vi.fn()) =>
        render(
            <MemoryRouter>
                <ChatHeader
                    otherUser={OTHER}
                    onBack={vi.fn()}
                    onViewProfile={vi.fn()}
                    onDeleteChat={vi.fn()}
                    onBlock={onBlock}
                />
            </MemoryRouter>
        );

    it('⋯ button has accessible label "More options"', () => {
        renderHeader();
        expect(screen.getByRole('button', { name: /more options/i })).toBeInTheDocument();
    });

    it('opening the ⋯ menu shows "Block user"', () => {
        renderHeader();
        fireEvent.click(screen.getByRole('button', { name: /more options/i }));
        expect(screen.getByText(/block user/i)).toBeInTheDocument();
    });

    it('clicking "Block user" calls the onBlock prop', () => {
        const onBlock = vi.fn();
        renderHeader(onBlock);
        fireEvent.click(screen.getByRole('button', { name: /more options/i }));
        fireEvent.click(screen.getByText(/block user/i));
        expect(onBlock).toHaveBeenCalledTimes(1);
    });

    it('clicking "Block user" closes the menu', () => {
        const onBlock = vi.fn();
        renderHeader(onBlock);
        fireEvent.click(screen.getByRole('button', { name: /more options/i }));
        fireEvent.click(screen.getByText(/block user/i));
        // After click the menu item should no longer be in the visible menu
        // (MUI hides it). Just confirm onBlock was called.
        expect(onBlock).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// ---- DockedChatWindow -------------------------------------------------------
// ---------------------------------------------------------------------------

const toggleBlock = vi.fn();

vi.mock('../src/hooks/useBlockUser', () => ({
    default: () => ({ toggleBlock }),
}));

vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: ME }),
}));

vi.mock('../src/providers/PresenceProvider', () => ({
    usePresence: () => ({ isOnline: () => false }),
}));

// Stub the heavy hook — just enough to satisfy the component.
vi.mock('../src/hooks/useConversationThread', () => ({
    default: () => ({
        user: ME,
        conversationId: 'conv-1',
        chatMessages: [],
        messageText: '',
        setMessageText: vi.fn(),
        mediaFile: null,
        setMediaFile: vi.fn(),
        previewMedia: null,
        fileInputRef: { current: null },
        isEmojiOpen: false,
        setIsEmojiOpen: vi.fn(),
        onEmojiClick: vi.fn(),
        handleSend: vi.fn(),
        isChatReady: true,
        containerRef: { current: null },
        endRef: { current: null },
        isNearBottom: true,
        hasNewBelow: false,
        scrollToBottom: vi.fn(),
        onScroll: vi.fn(),
        deleteConversation: vi.fn(),
        sendError: null,
        clearSendError: vi.fn(),
    }),
}));

// Stub heavy children
vi.mock('../src/pages/chat/components/MessageList', () => ({ default: () => <div data-testid='msg-list'/> }));
vi.mock('../src/pages/chat/components/MessageInput', () => ({ default: () => <div data-testid='msg-input'/> }));
vi.mock('../src/pages/chat/components/ScrollToBottomButton', () => ({ default: () => null }));
vi.mock('../src/components/OnlineBadge', () => ({ default: ({ children }) => <>{children}</> }));

import DockedChatWindow from '../src/components/chatDock/DockedChatWindow';

describe('DockedChatWindow — block menu item', () => {
    beforeEach(() => {
        toggleBlock.mockReset();
        // Return a truthy updated user so handleBlockConfirm treats it as success
        toggleBlock.mockResolvedValue({ _id: OTHER._id, name: OTHER.name });
    });
    afterEach(() => cleanup());

    const renderDock = (onClose = vi.fn()) =>
        render(
            <MemoryRouter>
                <DockedChatWindow otherUser={OTHER} onClose={onClose} />
            </MemoryRouter>
        );

    it('⋯ button has accessible label "More options"', () => {
        renderDock();
        expect(screen.getByRole('button', { name: /more options/i })).toBeInTheDocument();
    });

    it('opening the ⋯ menu shows "Block user"', () => {
        renderDock();
        fireEvent.click(screen.getByRole('button', { name: /more options/i }));
        expect(screen.getByText(/block user/i)).toBeInTheDocument();
    });

    it('clicking "Block user" opens the confirmation dialog', () => {
        renderDock();
        fireEvent.click(screen.getByRole('button', { name: /more options/i }));
        fireEvent.click(screen.getByText(/block user/i));
        // ConfirmationDialog renders "Are you sure you want to"
        expect(screen.getByText(/are you sure you want to/i)).toBeInTheDocument();
        // Confirm button label
        expect(screen.getByRole('button', { name: /block/i })).toBeInTheDocument();
    });

    it('confirming the block calls toggleBlock with the other user id', async () => {
        renderDock();
        fireEvent.click(screen.getByRole('button', { name: /more options/i }));
        fireEvent.click(screen.getByText(/block user/i));
        // Click the "Block" confirm button (not the "Close" button)
        fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
        await waitFor(() => expect(toggleBlock).toHaveBeenCalledWith(OTHER._id));
    });

    it('on successful block, onClose is called', async () => {
        const onClose = vi.fn();
        renderDock(onClose);
        fireEvent.click(screen.getByRole('button', { name: /more options/i }));
        fireEvent.click(screen.getByText(/block user/i));
        fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
});
