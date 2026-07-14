import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// LinkedIn-style dock: a single open chat window at a time + a persistent
// Messaging bar, shown only on desktop, only when logged in, and never on the
// full chat page (/chat). On mobile nothing renders (full-screen chat instead).

let mqDesktop = true;
vi.mock('@mui/material', async (orig) => ({ ...(await orig()), useMediaQuery: () => mqDesktop }));

let pathname = '/';
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useLocation: () => ({ pathname }) }));

let loggedIn = true;
vi.mock('../src/providers/authContext', () => ({ useAuth: () => ({ isLoggedIn: loggedIn }) }));

// Stub the heavy children (they pull in the whole chat/socket/presence stack).
vi.mock('../src/components/chatDock/DockedChatWindow', () => ({
    default: ({ otherUser }) => <div>window:{otherUser.name}</div>,
}));
vi.mock('../src/components/chatDock/MessagingBar', () => ({
    default: () => <div>messaging-bar</div>,
}));

import { ChatDockProvider } from '../src/providers/ChatDockProvider';
import { useChatDock } from '../src/providers/chatDockContext';
import ChatDock from '../src/components/chatDock/ChatDock';

function Controls() {
    const { openUser, openChat, closeChat, barOpen, toggleBar, openDock } = useChatDock();
    return (
        <div>
            <span data-testid='open'>{openUser?.name ?? 'none'}</span>
            <span data-testid='bar'>{String(barOpen)}</span>
            <button onClick={() => openChat({ _id: 'a', name: 'A' })}>openA</button>
            <button onClick={() => openChat({ _id: 'b', name: 'B' })}>openB</button>
            <button onClick={() => openDock({ _id: 'c', name: 'C' })}>openDockC</button>
            <button onClick={() => closeChat()}>close</button>
            <button onClick={() => toggleBar()}>toggleBar</button>
        </div>
    );
}

const renderDock = () =>
    render(<ChatDockProvider><Controls /><ChatDock /></ChatDockProvider>);

beforeEach(() => { mqDesktop = true; pathname = '/'; loggedIn = true; });
afterEach(() => cleanup());

describe('ChatDockProvider', () => {
    it('opens one chat window and SWAPS it when another is opened (only one open)', () => {
        renderDock();
        fireEvent.click(screen.getByText('openA'));
        expect(screen.getByTestId('open').textContent).toBe('A');
        fireEvent.click(screen.getByText('openB'));
        expect(screen.getByTestId('open').textContent).toBe('B'); // replaced, not added
    });

    it('openDock is a back-compat alias for openChat (profile "Message" button)', () => {
        renderDock();
        fireEvent.click(screen.getByText('openDockC'));
        expect(screen.getByTestId('open').textContent).toBe('C');
    });

    it('closeChat clears the open window', () => {
        renderDock();
        fireEvent.click(screen.getByText('openA'));
        fireEvent.click(screen.getByText('close'));
        expect(screen.getByTestId('open').textContent).toBe('none');
    });

    it('toggleBar flips the bar expanded state (default expanded)', () => {
        renderDock();
        expect(screen.getByTestId('bar').textContent).toBe('true');
        fireEvent.click(screen.getByText('toggleBar'));
        expect(screen.getByTestId('bar').textContent).toBe('false');
    });
});

describe('ChatDock rendering', () => {
    it('renders the messaging bar (and the open window) on desktop', () => {
        renderDock();
        expect(screen.getByText('messaging-bar')).toBeInTheDocument();
        fireEvent.click(screen.getByText('openA'));
        expect(screen.getByText('window:A')).toBeInTheDocument();
    });

    it('renders nothing on mobile (falls back to full-screen chat)', () => {
        mqDesktop = false;
        renderDock();
        expect(screen.queryByText('messaging-bar')).not.toBeInTheDocument();
    });

    it('renders nothing on the full chat page (/chat)', () => {
        pathname = '/chat';
        renderDock();
        expect(screen.queryByText('messaging-bar')).not.toBeInTheDocument();
    });

    it('renders nothing when logged out', () => {
        loggedIn = false;
        renderDock();
        expect(screen.queryByText('messaging-bar')).not.toBeInTheDocument();
    });
});
