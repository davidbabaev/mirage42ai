/**
 * Playwright E2E configuration for Mirage42.
 *
 * Run:  npm run test:e2e        (from repo root)
 *
 * This config boots both servers automatically:
 *   - API  on :8182  (in-memory Mongo, 8s access-token TTL, seeded users)
 *   - Vite on :5174  (pointed at the in-memory API, not Atlas)
 *
 * See e2e/README.md for why the weird numbers (8s TTL, 50s offline, reload
 * assertion) exist and must not be changed.
 */
'use strict';

const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
    testDir: path.join(__dirname, 'tests'),

    // One worker: both specs share the same in-memory database and the
    // token-expiry spec writes a message.  Two concurrent viewports would race
    // on the same conversation and could flip each other's reload assertion.
    workers: 1,

    // Default per-test timeout — smoke tests finish well inside this.
    // chat-token-expiry.spec.js overrides to 180 000 ms (deliberate ~70 s wait).
    timeout: 60_000,

    reporter: [['list']],

    use: {
        baseURL: 'http://localhost:5174',
        // Keep a trace on first retry so failures are diagnosable.
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'mobile-390',
            use: { viewport: { width: 390, height: 844 } },
        },
        {
            name: 'desktop-1280',
            use: { viewport: { width: 1280, height: 900 } },
        },
    ],

    webServer: [
        {
            // Real Express + Mongoose API on :8182 with in-memory MongoDB.
            // The server does not answer /_e2e_health until seeding is complete,
            // so Playwright only proceeds once test data exists.
            command: `node "${path.join(__dirname, 'support/api-server.cjs')}"`,
            url: 'http://localhost:8182/_e2e_health',
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            // Vite dev server for the web app.
            // VITE_API_URL points at the in-memory harness API, not Atlas.
            // This env var is merged with (and takes priority over) any .env file.
            command: 'npx vite --port 5174',
            cwd: path.join(__dirname, '../apps/web'),
            url: 'http://localhost:5174',
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
            env: {
                VITE_API_URL: 'http://localhost:8182',
            },
        },
    ],
});
