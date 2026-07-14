// Sentry initialisation helper for the Express API.
//
// NO-OP CONTRACT: if SENTRY_DSN is absent (local dev, CI, tests) this module
// does nothing — @sentry/node is not even require()'d, so there are zero side
// effects, zero network calls, and zero telemetry.  Sentry initialises ONLY
// when the DSN env var is present (staging / production).

'use strict';

// Lazily holds the Sentry SDK once initialised; null otherwise.
let _sentry = null;

/**
 * Initialise Sentry.  Must be called before Express and routes are set up so
 * that the OpenTelemetry auto-instrumentation can patch modules early.
 *
 * Safe to call unconditionally — returns immediately when SENTRY_DSN is unset.
 */
function initSentry() {
    if (!process.env.SENTRY_DSN) return; // no-op in local dev, CI, tests

    // Lazy require: @sentry/node is only loaded when a DSN is present.
    // This guarantees zero Sentry side-effects when the var is absent.
    _sentry = require('@sentry/node');
    _sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || 'production',
        sendDefaultPii: false, // never send passwords, emails, or IP addresses
    });
}

/**
 * Wire the Sentry Express error handler into the app BEFORE the application's
 * own error-handling middleware.  Sentry captures the error, then calls
 * next(err) so the existing handler continues to control what the client sees
 * — no stack traces or internal details are ever leaked to the client.
 *
 * Safe to call unconditionally — does nothing when Sentry was not initialised.
 *
 * @param {import('express').Application} app
 */
function applySentryErrorHandler(app) {
    if (!_sentry) return; // no-op when DSN was absent at boot
    _sentry.setupExpressErrorHandler(app);
}

module.exports = { initSentry, applySentryErrorHandler };
