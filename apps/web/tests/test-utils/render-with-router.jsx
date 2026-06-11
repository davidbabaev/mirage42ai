import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';

/**
 * Minimal reusable test helper: renders `ui` inside MemoryRouter so components
 * that use react-router hooks (useNavigate, useParams, useSearchParams, ...)
 * work in isolation without standing up the real Router tree from main.jsx.
 *
 * For tests that also need Auth / Cards / Users / Theme context, prefer
 * vi.mock'ing the specific provider hooks the component reads — that keeps
 * each test self-contained. If we later see the same provider tree repeated
 * across many tests we can extend this helper to wrap them too.
 */
export function renderWithRouter(ui, { initialEntries = ['/'] } = {}) {
    return render(
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    );
}
