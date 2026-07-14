// Proves the no-op contract for the web Sentry helper: when VITE_SENTRY_DSN is
// absent (which is always the case in the test / CI environment because Vite
// does not inject VITE_* env vars into the test runner), initSentry() must
// return without calling Sentry.init().

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock is hoisted by Vitest before any imports execute, so when sentry.js
// loads @sentry/react it receives this mock — not the real SDK.
vi.mock('@sentry/react', () => ({
    init: vi.fn(),
    // Minimal ErrorBoundary stub so any component tree importing it can render.
    ErrorBoundary: ({ children }) => children,
}));

import * as MockedSentry from '@sentry/react';
import { initSentry } from '../src/utils/sentry.js';

describe('sentry no-op contract (Web)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('VITE_SENTRY_DSN is not set in the test environment', () => {
        // This assertion locks in the safety invariant: if someone accidentally
        // sets VITE_SENTRY_DSN in the test env the suite will catch it before
        // a real Sentry network call can happen.
        expect(import.meta.env.VITE_SENTRY_DSN).toBeFalsy();
    });

    it('initSentry() does not call Sentry.init when VITE_SENTRY_DSN is absent', () => {
        initSentry();
        expect(MockedSentry.init).not.toHaveBeenCalled();
    });
});
