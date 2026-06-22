import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../src/providers/ThemeProvider';

// Layer 2: the theme SELECTION ('light'|'dark'|'system', default 'system') is
// persisted under localStorage 'theme'; 'system' resolves to the OS preference
// live; explicit choices override the OS. jsdom has no matchMedia, so we stub it
// with a controllable `matches` + change listeners to drive the OS query.

let mediaListeners;
function installMatchMedia(initialMatches) {
    mediaListeners = new Set();
    let matches = initialMatches;
    const mql = {
        get matches() { return matches; },
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: (_evt, cb) => mediaListeners.add(cb),
        removeEventListener: (_evt, cb) => mediaListeners.delete(cb),
        addListener: (cb) => mediaListeners.add(cb),       // deprecated API MUI may use
        removeListener: (cb) => mediaListeners.delete(cb),
        dispatchEvent: () => true,
    };
    window.matchMedia = vi.fn().mockImplementation(() => mql);
    return {
        setMatches: (v) => {
            matches = v;
            act(() => { mediaListeners.forEach((cb) => cb({ matches })); });
        },
    };
}

function Probe() {
    const { darkMode, themeSelection, setThemeSelection, handleToggle } = useThemeContext();
    return (
        <>
            <span data-testid="mode">{darkMode ? 'dark' : 'light'}</span>
            <span data-testid="selection">{themeSelection}</span>
            <button onClick={() => setThemeSelection('light')}>light</button>
            <button onClick={() => setThemeSelection('dark')}>dark</button>
            <button onClick={() => setThemeSelection('system')}>system</button>
            <button onClick={handleToggle}>toggle</button>
        </>
    );
}

const renderProvider = () => render(<ThemeProvider><Probe /></ThemeProvider>);
const mode = () => screen.getByTestId('mode').textContent;
const selection = () => screen.getByTestId('selection').textContent;

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('ThemeProvider Layer 2 — Light/Dark/System', () => {
    it("defaults to 'system' selection when nothing is stored", () => {
        installMatchMedia(false);
        renderProvider();
        expect(selection()).toBe('system');
    });

    it("'system' resolves to dark when the OS prefers dark, light otherwise", () => {
        installMatchMedia(true);
        renderProvider();
        expect(selection()).toBe('system');
        expect(mode()).toBe('dark');
        cleanup();

        installMatchMedia(false);
        renderProvider();
        expect(mode()).toBe('light');
    });

    it("honors a pre-existing 'dark' selection (Layer 1 migration)", () => {
        installMatchMedia(false); // OS=light...
        localStorage.setItem('theme', 'dark');
        renderProvider();
        expect(selection()).toBe('dark');
        expect(mode()).toBe('dark'); // ...explicit dark still wins
    });

    it("honors a pre-existing 'light' selection (Layer 1 migration)", () => {
        installMatchMedia(true); // OS=dark...
        localStorage.setItem('theme', 'light');
        renderProvider();
        expect(selection()).toBe('light');
        expect(mode()).toBe('light'); // ...explicit light still wins
    });

    it('explicit selection overrides the OS preference', () => {
        installMatchMedia(true); // OS=dark
        localStorage.setItem('theme', 'light');
        renderProvider();
        expect(mode()).toBe('light');
    });

    it("persists each selection as its string under 'theme'", () => {
        installMatchMedia(false);
        renderProvider();

        fireEvent.click(screen.getByText('dark'));
        expect(selection()).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');

        fireEvent.click(screen.getByText('light'));
        expect(localStorage.getItem('theme')).toBe('light');

        fireEvent.click(screen.getByText('system'));
        expect(localStorage.getItem('theme')).toBe('system');
    });

    it("follows the OS LIVE while selection is 'system'", () => {
        const mm = installMatchMedia(false);
        renderProvider();
        expect(selection()).toBe('system');
        expect(mode()).toBe('light');

        mm.setMatches(true); // OS flips to dark
        expect(mode()).toBe('dark');

        mm.setMatches(false); // OS flips back to light
        expect(mode()).toBe('light');
    });

    it("handleToggle flips between explicit light/dark (back-compat)", () => {
        installMatchMedia(false);
        renderProvider();
        expect(mode()).toBe('light');

        fireEvent.click(screen.getByText('toggle'));
        expect(selection()).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');

        fireEvent.click(screen.getByText('toggle'));
        expect(selection()).toBe('light');
    });
});
