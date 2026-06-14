import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, cleanup } from '@testing-library/react';
import { renderWithRouter } from './test-utils/render-with-router';
import { VideoCoordinatorProvider } from '../src/providers/VideoCoordinatorProvider';
import MediaDisplay from '../src/components/MediaDisplay';

// Pausing the background feed video is now declarative: the modal's own video
// (videoMode="modal") claims the single "active" slot on mount, and the
// coordinator pauses every OTHER managed video that is currently playing.
// (The old imperative document.querySelectorAll('video') sweep was removed.)
//
// jsdom never actually plays media, so a managed video always reports
// paused === true and the coordinator — which only pauses a video when
// !v.paused — would have nothing to pause. We therefore force the feed videos
// to report as "playing" so the enforcement path is exercised. The real
// play/pause timing is browser-verified (Playwright), not asserted here.
function forcePlaying(el) {
    Object.defineProperty(el, 'paused', { configurable: true, value: false });
}

// Spy on HTMLMediaElement.prototype.pause; mock.contexts records `this` (the
// element) for each call, so we can assert WHICH videos were paused.
let pauseSpy;
beforeEach(() => {
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    // jsdom doesn't implement play(); stub it so the coordinator's
    // enforcement effect (v.play() on the active video) doesn't throw.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// Mirrors FeedPage: managed feed videos rendered as siblings, plus a
// state-driven modal-mode video mounted on user interaction.
function Harness({ feedUrls }) {
    const [open, setOpen] = useState(false);
    return (
        <VideoCoordinatorProvider>
            {feedUrls.map((u, i) => (
                <div key={u} data-testid={`feed-wrap-${i}`}>
                    <MediaDisplay mediaUrl={u} mediaType="video" videoMode="feed" />
                </div>
            ))}
            <button data-testid="open" onClick={() => setOpen(true)}>open</button>
            {open && (
                <div data-testid="modal-wrap">
                    <MediaDisplay mediaUrl="modal-clip" mediaType="video" videoMode="modal" />
                </div>
            )}
        </VideoCoordinatorProvider>
    );
}

const videoIn = (testid) => screen.getByTestId(testid).querySelector('video');

describe('VideoCoordinator — single active video', () => {
    it('pauses a playing feed video when the modal video claims active', () => {
        renderWithRouter(<Harness feedUrls={['feed-a']} />);
        const feedVideo = videoIn('feed-wrap-0');
        forcePlaying(feedVideo);

        fireEvent.click(screen.getByTestId('open'));

        expect(pauseSpy.mock.contexts).toContain(feedVideo);
    });

    it("does NOT pause the modal's own video", () => {
        renderWithRouter(<Harness feedUrls={['feed-a']} />);
        forcePlaying(videoIn('feed-wrap-0'));

        fireEvent.click(screen.getByTestId('open'));

        const modalVideo = videoIn('modal-wrap');
        expect(pauseSpy.mock.contexts).not.toContain(modalVideo);
    });

    it('pauses every playing feed video when the modal opens', () => {
        renderWithRouter(<Harness feedUrls={['feed-a', 'feed-b']} />);
        const a = videoIn('feed-wrap-0');
        const b = videoIn('feed-wrap-1');
        forcePlaying(a);
        forcePlaying(b);

        fireEvent.click(screen.getByTestId('open'));

        expect(pauseSpy.mock.contexts).toContain(a);
        expect(pauseSpy.mock.contexts).toContain(b);
    });

    it('manually playing one video pauses the others', () => {
        renderWithRouter(<Harness feedUrls={['feed-a', 'feed-b']} />);
        const a = videoIn('feed-wrap-0');
        const b = videoIn('feed-wrap-1');
        forcePlaying(a);
        forcePlaying(b);

        // Simulate the user pressing play on the first video.
        fireEvent(a, new Event('play'));

        // The other video gets paused; the one that claimed active does not.
        expect(pauseSpy.mock.contexts).toContain(b);
        expect(pauseSpy.mock.contexts).not.toContain(a);
    });
});
