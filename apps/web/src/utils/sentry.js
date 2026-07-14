// Sentry initialisation helper for the React app.
//
// NO-OP CONTRACT: if VITE_SENTRY_DSN is absent (local dev, CI, tests) this
// module does NOT call Sentry.init(), making zero network calls and registering
// nothing.  Vite inlines import.meta.env values at build time; a missing var
// is undefined at runtime (and in the test environment).
//
// The Sentry namespace is re-exported so callers can use Sentry.ErrorBoundary
// without a second direct import of @sentry/react.

import * as Sentry from '@sentry/react';

/**
 * Initialise Sentry.  Call once, before createRoot, from main.jsx.
 *
 * Safe to call unconditionally — returns immediately when VITE_SENTRY_DSN is
 * not set.
 */
export function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return; // no-op in local dev, CI, tests

    Sentry.init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production',
        sendDefaultPii: false,
    });
}

export { Sentry };
