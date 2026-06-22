import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CountryFlag from '../src/components/CountryFlag';

afterEach(() => { cleanup(); });

describe('CountryFlag', () => {
    it('renders the local ISO-coded flag asset for a known country', () => {
        render(<CountryFlag country="Israel" />);
        const img = screen.getByRole('img', { name: /israel flag/i });
        expect(img).toHaveAttribute('src', '/flags/il.svg');
    });

    it('matches the country name case-insensitively', () => {
        render(<CountryFlag country="united states" />);
        expect(screen.getByRole('img')).toHaveAttribute('src', '/flags/us.svg');
    });

    it('falls back to the local placeholder for an unknown/legacy country', () => {
        render(<CountryFlag country="Atlantis" />);
        const img = screen.getByRole('img', { name: /atlantis flag/i });
        expect(img).toHaveAttribute('src', '/flags/_placeholder.svg');
    });

    it('falls back to the local placeholder when no country is provided', () => {
        render(<CountryFlag country={undefined} />);
        expect(screen.getByRole('img')).toHaveAttribute('src', '/flags/_placeholder.svg');
    });

    it('never points at an external URL', () => {
        render(<CountryFlag country="Atlantis" />);
        const src = screen.getByRole('img').getAttribute('src');
        expect(src.startsWith('/flags/')).toBe(true);
    });
});
