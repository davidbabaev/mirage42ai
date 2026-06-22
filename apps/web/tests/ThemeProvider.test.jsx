import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../src/providers/ThemeProvider';

// Layer 1 of the theme work: the dark/light choice must persist to localStorage
// (as the string 'dark'/'light') and be read synchronously on init so a refresh
// restores it. These tests prove init-from-storage and write-on-toggle.

function Probe() {
    const { darkMode, handleToggle } = useThemeContext();
    return (
        <>
            <span data-testid="mode">{darkMode ? 'dark' : 'light'}</span>
            <button onClick={handleToggle}>toggle</button>
        </>
    );
}

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); });

describe('ThemeProvider persistence (Layer 1)', () => {
    it('defaults to light when nothing is stored', () => {
        render(<ThemeProvider><Probe /></ThemeProvider>);
        expect(screen.getByTestId('mode')).toHaveTextContent('light');
    });

    it("initializes in dark mode when localStorage theme is 'dark'", () => {
        localStorage.setItem('theme', 'dark');
        render(<ThemeProvider><Probe /></ThemeProvider>);
        expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    });

    it("writes 'dark' then 'light' to localStorage as the mode toggles", () => {
        render(<ThemeProvider><Probe /></ThemeProvider>);
        // mounts light -> effect persists 'light'
        expect(localStorage.getItem('theme')).toBe('light');

        fireEvent.click(screen.getByText('toggle'));
        expect(screen.getByTestId('mode')).toHaveTextContent('dark');
        expect(localStorage.getItem('theme')).toBe('dark');

        fireEvent.click(screen.getByText('toggle'));
        expect(screen.getByTestId('mode')).toHaveTextContent('light');
        expect(localStorage.getItem('theme')).toBe('light');
    });

    it("stores the string form, not a boolean", () => {
        localStorage.setItem('theme', 'dark');
        render(<ThemeProvider><Probe /></ThemeProvider>);
        const stored = localStorage.getItem('theme');
        expect(typeof stored).toBe('string');
        expect(['light', 'dark']).toContain(stored);
    });
});
