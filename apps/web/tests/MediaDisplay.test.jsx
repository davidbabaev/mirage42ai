/**
 * MediaDisplay tests
 *
 * Covers the broken-image fallback: a post image whose URL fails to load must
 * surface an "Image unavailable" placeholder instead of the browser's broken
 * glyph, and must report the failure to the caller via onError.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// useManagedVideo is only invoked when a video renders; stub it so importing
// MediaDisplay never touches the real VideoCoordinator context.
vi.mock('../src/providers/VideoCoordinatorProvider', () => ({
    useManagedVideo: () => {},
}));

import MediaDisplay from '../src/components/MediaDisplay';

afterEach(() => cleanup());

describe('MediaDisplay — broken image handling', () => {
    it('renders the image normally before any error', () => {
        render(<MediaDisplay mediaUrl='https://example.com/ok.jpg' mediaType='image' style={{}} />);
        expect(document.querySelector('img')).toBeInTheDocument();
        expect(screen.queryByText('Image unavailable')).not.toBeInTheDocument();
    });

    it('shows an "Image unavailable" fallback when the image fails to load', () => {
        render(<MediaDisplay mediaUrl='https://example.com/broken.jpg' mediaType='image' style={{}} />);
        const img = document.querySelector('img');
        fireEvent.error(img);
        expect(screen.getByText('Image unavailable')).toBeInTheDocument();
        expect(document.querySelector('img')).not.toBeInTheDocument();
    });

    it('invokes onError so composers can reject the broken media', () => {
        const onError = vi.fn();
        render(
            <MediaDisplay mediaUrl='https://example.com/broken.jpg' mediaType='image' style={{}} onError={onError} />
        );
        fireEvent.error(document.querySelector('img'));
        expect(onError).toHaveBeenCalledOnce();
    });
});
