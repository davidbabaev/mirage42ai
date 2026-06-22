import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ScrollToTop from '../src/components/ScrollToTop';

// ScrollToTop resets the app's INNER scroll container (#app-scroll-container) —
// not the window — to the top on every pathname change. window.scrollTo was the
// old no-op bug, so the meaningful assertion is "scrollTo was called on the
// container element when the path changes".

function Nav() {
    const navigate = useNavigate();
    return <button onClick={() => navigate('/other')}>go</button>;
}

afterEach(() => cleanup());

describe('ScrollToTop', () => {
    it('scrolls #app-scroll-container to the top on pathname change', () => {
        const container = document.createElement('div');
        container.id = 'app-scroll-container';
        const scrollSpy = vi.fn();
        container.scrollTo = scrollSpy; // jsdom doesn't implement scrollTo
        document.body.appendChild(container);

        render(
            <MemoryRouter initialEntries={['/start']}>
                <ScrollToTop />
                <Routes>
                    <Route path="/start" element={<Nav />} />
                    <Route path="/other" element={<div>other</div>} />
                </Routes>
            </MemoryRouter>
        );

        // initial mount resets once
        expect(scrollSpy).toHaveBeenCalledWith({ top: 0 });
        scrollSpy.mockClear();

        // navigating to a new path resets again
        fireEvent.click(screen.getByText('go'));
        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(scrollSpy).toHaveBeenCalledWith({ top: 0 });

        container.remove();
    });

    it('does not throw when the container is absent', () => {
        expect(() =>
            render(
                <MemoryRouter initialEntries={['/x']}>
                    <ScrollToTop />
                </MemoryRouter>
            )
        ).not.toThrow();
    });
});
