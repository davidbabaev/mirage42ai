import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderWithRouter } from './test-utils/render-with-router';

// CardPopupModal renders CardDetailsModal, which pulls in Auth, Cards, Users,
// Follow, Comments providers, MUI, react-router, etc. None of that matters for
// the behavior under test (does the modal pause background videos on mount?),
// so we stub it out to keep the test focused and dependency-light.
vi.mock('../src/components/card/CardDetailsModal', () => ({
    default: () => <div data-testid="card-details-modal-stub" />,
}));

import CardPopupModal from '../src/components/card/CardPopupModal';

afterEach(() => {
    // Remove any background video nodes the test appended directly to body so
    // they don't leak into the next test.
    document.querySelectorAll('video[data-test-bg-video]').forEach(v => v.remove());
});

describe('CardPopupModal', () => {
    it('pauses background <video> elements when it opens', () => {
        // Simulate a video playing in the feed behind the modal.
        const bgVideo = document.createElement('video');
        bgVideo.dataset.testBgVideo = 'true';
        document.body.appendChild(bgVideo);
        const pauseSpy = vi.spyOn(bgVideo, 'pause');

        renderWithRouter(<CardPopupModal cardId="card-abc" onClose={() => {}} />);

        // Pre-fix the mount effect only toggled body overflow and left every
        // <video> on the page playing. Post-fix it calls pause() on each one,
        // which silences the feed video behind the modal. The modal's own
        // <video> (inside CardDetailsModal — here stubbed out) isn't
        // autoplaying, so pausing it is a no-op until the user clicks play.
        expect(pauseSpy).toHaveBeenCalledTimes(1);
    });

    it('pauses multiple background videos, not just the first', () => {
        const v1 = document.createElement('video');
        const v2 = document.createElement('video');
        v1.dataset.testBgVideo = 'true';
        v2.dataset.testBgVideo = 'true';
        document.body.appendChild(v1);
        document.body.appendChild(v2);
        const s1 = vi.spyOn(v1, 'pause');
        const s2 = vi.spyOn(v2, 'pause');

        renderWithRouter(<CardPopupModal cardId="card-abc" onClose={() => {}} />);

        expect(s1).toHaveBeenCalledTimes(1);
        expect(s2).toHaveBeenCalledTimes(1);
    });
});
