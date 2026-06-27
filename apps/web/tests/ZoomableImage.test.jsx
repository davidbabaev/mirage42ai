import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MediaDisplay from '../src/components/MediaDisplay';

// The post modal opts into image zoom via `zoomable`. react-zoom-pan-pinch
// wraps the <img> in a `.react-transform-wrapper` container that owns the
// pinch/scroll/double-click + pan gestures. The actual gesture behavior is
// browser-verified (Playwright); here we assert the wiring: zoomable images
// get the transform wrapper, plain ones don't, and videos ignore zoom.
afterEach(cleanup);

describe('MediaDisplay — zoomable image (post modal)', () => {
    it('wraps a zoomable image in the pan/zoom transform container', () => {
        render(<MediaDisplay mediaUrl="pic.jpg" mediaType="image" zoomable />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'pic.jpg');
        // The image lives inside react-zoom-pan-pinch's transform wrapper.
        expect(img.closest('.react-transform-wrapper')).not.toBeNull();
    });

    it('renders a plain image (no zoom wrapper) when not zoomable', () => {
        render(<MediaDisplay mediaUrl="pic.jpg" mediaType="image" />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'pic.jpg');
        expect(img.closest('.react-transform-wrapper')).toBeNull();
    });

    it('ignores zoom for videos (renders a video element)', () => {
        const { container } = render(
            <MediaDisplay mediaUrl="clip.mp4" mediaType="video" zoomable />
        );
        expect(container.querySelector('video')).not.toBeNull();
        expect(container.querySelector('.react-transform-wrapper')).toBeNull();
    });
});
