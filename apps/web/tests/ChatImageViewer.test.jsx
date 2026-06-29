import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock ZoomableImage so react-zoom-pan-pinch + transform DOM complexity
// are sidestepped. The status / load flow and the close-button wiring are
// what we're testing here — not the zoom library itself.
vi.mock('../src/components/ZoomableImage', () => ({
    default: ({ mediaUrl, alt }) => (
        <img src={mediaUrl} alt={alt} data-testid="zoomable-img" />
    ),
}));

import ChatImageViewer from '../src/components/ChatImageViewer';

afterEach(cleanup);

describe('ChatImageViewer', () => {
    it('renders no content when closed (open=false)', () => {
        render(<ChatImageViewer src="http://ex.com/img.jpg" open={false} onClose={() => {}} />);
        // MUI Dialog does not mount paper content when open=false + keepMounted=false
        expect(screen.queryByRole('button', { name: /close image viewer/i })).toBeNull();
    });

    it('shows the close button when open', () => {
        render(<ChatImageViewer src="http://ex.com/img.jpg" open onClose={() => {}} />);
        expect(screen.getByRole('button', { name: /close image viewer/i })).toBeInTheDocument();
    });

    it('renders the image via ZoomableImage with the correct src', () => {
        render(<ChatImageViewer src="http://ex.com/img.jpg" open onClose={() => {}} />);
        const img = screen.getByTestId('zoomable-img');
        expect(img).toHaveAttribute('src', 'http://ex.com/img.jpg');
    });

    it('passes descriptive alt text to ZoomableImage', () => {
        render(<ChatImageViewer src="http://ex.com/img.jpg" open onClose={() => {}} />);
        const img = screen.getByTestId('zoomable-img');
        expect(img).toHaveAttribute('alt', 'Full-size chat image');
    });

    it('calls onClose when the X button is clicked', () => {
        const onClose = vi.fn();
        render(<ChatImageViewer src="http://ex.com/img.jpg" open onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: /close image viewer/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('close button has aria-label for accessibility', () => {
        render(<ChatImageViewer src="http://ex.com/img.jpg" open onClose={() => {}} />);
        const btn = screen.getByRole('button', { name: /close image viewer/i });
        expect(btn).toHaveAttribute('aria-label', 'Close image viewer');
    });
});
