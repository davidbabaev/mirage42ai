import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

let mqDesktop = true;
vi.mock('@mui/material', async (orig) => ({ ...(await orig()), useMediaQuery: () => mqDesktop }));

// Stub the heavy window (it pulls in the whole chat/socket stack).
vi.mock('../src/components/chatDock/DockedChatWindow', () => ({
    default: ({ otherUser }) => <div>dock:{otherUser.name}</div>,
}));

import { ChatDockProvider, useChatDock } from '../src/providers/ChatDockProvider';
import ChatDock from '../src/components/chatDock/ChatDock';

function Controls() {
    const { docks, openDock, closeDock, toggleMinimize } = useChatDock();
    return (
        <div>
            <span data-testid='count'>{docks.length}</span>
            <span data-testid='state'>{docks.map((d) => `${d.otherUser.name}:${d.minimized}`).join(',')}</span>
            <button onClick={() => openDock({ _id: 'a', name: 'A' })}>openA</button>
            <button onClick={() => openDock({ _id: 'b', name: 'B' })}>openB</button>
            <button onClick={() => openDock({ _id: 'c', name: 'C' })}>openC</button>
            <button onClick={() => openDock({ _id: 'd', name: 'D' })}>openD</button>
            <button onClick={() => toggleMinimize('a')}>minA</button>
            <button onClick={() => closeDock('a')}>closeA</button>
        </div>
    );
}

const renderDock = () =>
    render(<ChatDockProvider><Controls /><ChatDock /></ChatDockProvider>);

beforeEach(() => { mqDesktop = true; });
afterEach(() => cleanup());

describe('ChatDockProvider', () => {
    it('opens one dock and de-dupes repeat opens of the same user', () => {
        renderDock();
        fireEvent.click(screen.getByText('openA'));
        expect(screen.getByTestId('count').textContent).toBe('1');
        fireEvent.click(screen.getByText('openA'));
        expect(screen.getByTestId('count').textContent).toBe('1');
    });

    it('caps at 3 docks, newest first', () => {
        renderDock();
        ['openA', 'openB', 'openC', 'openD'].forEach((b) => fireEvent.click(screen.getByText(b)));
        expect(screen.getByTestId('count').textContent).toBe('3');
        expect(screen.getByTestId('state').textContent).toBe('D:false,C:false,B:false');
    });

    it('minimize and close work', () => {
        renderDock();
        fireEvent.click(screen.getByText('openA'));
        fireEvent.click(screen.getByText('minA'));
        expect(screen.getByTestId('state').textContent).toBe('A:true');
        fireEvent.click(screen.getByText('closeA'));
        expect(screen.getByTestId('count').textContent).toBe('0');
    });
});

describe('ChatDock rendering', () => {
    it('renders docked windows on desktop', () => {
        mqDesktop = true;
        renderDock();
        fireEvent.click(screen.getByText('openA'));
        expect(screen.getByText('dock:A')).toBeInTheDocument();
    });

    it('renders nothing on mobile (falls back to full-screen chat)', () => {
        mqDesktop = false;
        renderDock();
        fireEvent.click(screen.getByText('openA'));
        expect(screen.queryByText('dock:A')).not.toBeInTheDocument();
    });
});
