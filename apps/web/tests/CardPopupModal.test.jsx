import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, cleanup } from '@testing-library/react';
import { renderWithRouter } from './test-utils/render-with-router';

// Stub CardDetailsModal so we don't need the real provider tree, but make the
// stub render its OWN <video> element. That lets us assert two things:
//   1. The feed video (rendered by the harness, simulating CardItem's video)
//      pauses when the modal mounts.
//   2. The modal's own video does NOT get paused — otherwise the user would
//      have to click play in the modal too, which is the wrong UX.
vi.mock('../src/components/card/CardDetailsModal', () => ({
    default: () => <video src="" controls data-testid="modal-video" />,
}));

import CardPopupModal from '../src/components/card/CardPopupModal';

// Faithful approximation of FeedPage's relationship to CardPopupModal:
// a sibling <video> element rendered by React (the feed card's video) and a
// state-driven modal mount triggered by user interaction (FeedPage does this
// via setSelectedCardId in CardItem's onOpenCard).
function FeedHarness() {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            <video src="" controls data-testid="feed-video" />
            <button data-testid="open" onClick={() => setIsOpen(true)}>open</button>
            {isOpen && <CardPopupModal cardId="abc" onClose={() => setIsOpen(false)} />}
        </>
    );
}

// Spy on HTMLMediaElement.prototype.pause so we can inspect *which* elements
// it was called on after the modal mounts. mock.contexts records `this` for
// each call, which is the element pause() was invoked on. We install this in
// beforeEach so it's in place before any render happens and survives the
// mount of the modal's own video (which we can't spy on after the fact —
// the modal's mount effect runs synchronously inside fireEvent.click).
let prototypePauseSpy;
beforeEach(() => {
    prototypePauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause');
});

// We don't have globals: true in vitest.config, so @testing-library/react's
// own automatic afterEach cleanup doesn't get installed. Run it manually so
// each test starts with an empty DOM (otherwise getByTestId hits stale nodes
// from the previous test). Also restore the prototype spy so it doesn't
// accumulate on HTMLMediaElement.prototype across tests.
afterEach(() => {
    cleanup();
    prototypePauseSpy.mockRestore();
});

describe('CardPopupModal — realistic composition', () => {
    it('pauses a React-rendered feed video when state opens the modal', () => {
        renderWithRouter(<FeedHarness />);
        const feedVideo = screen.getByTestId('feed-video');

        fireEvent.click(screen.getByTestId('open'));

        expect(prototypePauseSpy.mock.contexts).toContain(feedVideo);
    });

    it('does NOT pause the modal\'s own video', () => {
        renderWithRouter(<FeedHarness />);

        fireEvent.click(screen.getByTestId('open'));

        const modalVideo = screen.getByTestId('modal-video');
        expect(prototypePauseSpy.mock.contexts).not.toContain(modalVideo);
    });

    it('pauses every background video when there are multiple feed cards', () => {
        function MultiHarness() {
            const [isOpen, setIsOpen] = useState(false);
            return (
                <>
                    <video src="" controls data-testid="feed-video-a" />
                    <video src="" controls data-testid="feed-video-b" />
                    <button data-testid="open" onClick={() => setIsOpen(true)}>open</button>
                    {isOpen && <CardPopupModal cardId="abc" onClose={() => setIsOpen(false)} />}
                </>
            );
        }
        renderWithRouter(<MultiHarness />);
        const a = screen.getByTestId('feed-video-a');
        const b = screen.getByTestId('feed-video-b');

        fireEvent.click(screen.getByTestId('open'));

        expect(prototypePauseSpy.mock.contexts).toContain(a);
        expect(prototypePauseSpy.mock.contexts).toContain(b);
    });
});
