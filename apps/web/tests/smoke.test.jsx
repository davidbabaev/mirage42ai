import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Intentionally trivial: defined inline so the smoke test pulls in zero app code
// (no providers, no router, no apiService, no MUI). It just proves the harness
// can render JSX, jsdom is wired up, and the jest-dom matchers are loaded.
function Hello() {
    return <h1>Hello, mirage42ai!</h1>;
}

describe('frontend smoke', () => {
    it('renders a trivial component into the DOM', () => {
        render(<Hello />);
        expect(
            screen.getByRole('heading', { name: /hello, mirage42ai/i })
        ).toBeInTheDocument();
    });
});
