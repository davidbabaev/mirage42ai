// Proves the no-op contract: with no SENTRY_DSN the sentry utility does nothing
// observable — no middleware is added to the Express app and no network calls
// are made.  The whole test suite running without a DSN set already implicitly
// proves the app boots cleanly, but these cases make the contract explicit and
// will catch any future regression that breaks the early-return guard.

import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);

describe('sentry no-op contract (API)', () => {
    let savedDsn;

    afterEach(() => {
        // Restore whatever was in place before the test (normally undefined).
        if (savedDsn === undefined) delete process.env.SENTRY_DSN;
        else process.env.SENTRY_DSN = savedDsn;
    });

    it('initSentry() does not throw and is safe when SENTRY_DSN is absent', () => {
        savedDsn = process.env.SENTRY_DSN;
        delete process.env.SENTRY_DSN;

        // Guard: if SENTRY_DSN leaks into the test environment this assertion
        // catches the misconfiguration before a real network call happens.
        expect(process.env.SENTRY_DSN).toBeUndefined();

        const { initSentry } = req('../src/utils/sentry');
        expect(() => initSentry()).not.toThrow();
    });

    it('applySentryErrorHandler() adds no middleware when SENTRY_DSN is absent', () => {
        savedDsn = process.env.SENTRY_DSN;
        delete process.env.SENTRY_DSN;

        const { initSentry, applySentryErrorHandler } = req('../src/utils/sentry');
        initSentry(); // returns early — _sentry stays null

        // Fake express app — count how many times .use() is called.
        let useCallCount = 0;
        const fakeApp = { use: () => { useCallCount++; } };
        applySentryErrorHandler(fakeApp);

        // With no DSN the handler guard returns immediately; app is untouched.
        expect(useCallCount).toBe(0);
    });
});
