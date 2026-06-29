import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock ChatImageViewer with a simple controlled component so we're testing
// MessageList wiring — not MUI Dialog transition behaviour in jsdom.
vi.mock('../src/components/ChatImageViewer', () => ({
    default: ({ src, open, onClose }) =>
        open ? (
            <div data-testid="image-viewer">
                <img src={src} alt="viewer-img" data-testid="viewer-img" />
                <button onClick={onClose} aria-label="Close image viewer">X</button>
            </div>
        ) : null,
}));

// Stub children that pull in heavy or side-effectful dependencies.
vi.mock('../src/pages/chat/components/SharedPostCard', () => ({
    default: () => <div data-testid="shared-card" />,
}));
vi.mock('../src/utils/getMessageTime', () => ({ default: () => '12:00' }));

import MessageList from '../src/pages/chat/components/MessageList';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ME = 'user-me';
const OTHER = { _id: 'user-other', profilePicture: '' };

function makeMsg(overrides = {}) {
    return {
        _id: `msg-${Math.random()}`,
        userId: ME,
        text: '',
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

function renderList(messages) {
    return render(
        <MessageList
            messages={messages}
            currentUserId={ME}
            otherUser={OTHER}
            containerRef={{ current: null }}
            endRef={{ current: null }}
            isChatReady
            onScroll={() => {}}
        />,
    );
}

afterEach(cleanup);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MessageList — chat image tap-to-zoom wiring', () => {
    it('clicking an image message opens the fullscreen viewer with the correct src', () => {
        renderList([makeMsg({ mediaUrl: 'http://ex.com/photo.jpg', mediaType: 'image' })]);

        // No viewer before click
        expect(screen.queryByTestId('image-viewer')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /view full-size image/i }));

        // Viewer now visible with correct src
        expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
        expect(screen.getByTestId('viewer-img')).toHaveAttribute('src', 'http://ex.com/photo.jpg');
    });

    it('closing the viewer via the X button dismisses it', () => {
        renderList([makeMsg({ mediaUrl: 'http://ex.com/photo.jpg', mediaType: 'image' })]);

        fireEvent.click(screen.getByRole('button', { name: /view full-size image/i }));
        expect(screen.getByTestId('image-viewer')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /close image viewer/i }));
        expect(screen.queryByTestId('image-viewer')).toBeNull();
    });

    it('Enter key on the image bubble opens the viewer', () => {
        renderList([makeMsg({ mediaUrl: 'http://ex.com/photo.jpg', mediaType: 'image' })]);
        const trigger = screen.getByRole('button', { name: /view full-size image/i });
        fireEvent.keyDown(trigger, { key: 'Enter' });
        expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
    });

    it('Space key on the image bubble opens the viewer', () => {
        renderList([makeMsg({ mediaUrl: 'http://ex.com/photo.jpg', mediaType: 'image' })]);
        const trigger = screen.getByRole('button', { name: /view full-size image/i });
        fireEvent.keyDown(trigger, { key: ' ' });
        expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
    });

    it('image messages in "sending" state are not clickable', () => {
        renderList([makeMsg({ mediaUrl: 'http://ex.com/photo.jpg', mediaType: 'image', status: 'sending' })]);
        expect(screen.queryByRole('button', { name: /view full-size image/i })).toBeNull();
    });

    it('image messages in "failed" state are not clickable', () => {
        renderList([makeMsg({ mediaUrl: 'http://ex.com/photo.jpg', mediaType: 'image', status: 'failed' })]);
        expect(screen.queryByRole('button', { name: /view full-size image/i })).toBeNull();
    });

    it('video messages do not get the zoom handler', () => {
        renderList([makeMsg({ mediaUrl: 'http://ex.com/clip.mp4', mediaType: 'video' })]);
        expect(screen.queryByRole('button', { name: /view full-size image/i })).toBeNull();
    });

    it('text-only messages do not get the zoom handler', () => {
        renderList([makeMsg({ text: 'hello world' })]);
        expect(screen.queryByRole('button', { name: /view full-size image/i })).toBeNull();
    });

    it('shared-card-only messages (no mediaUrl) do not get the zoom handler', () => {
        renderList([makeMsg({ sharedCard: { cardId: 'c1' } })]);
        expect(screen.queryByRole('button', { name: /view full-size image/i })).toBeNull();
    });
});
