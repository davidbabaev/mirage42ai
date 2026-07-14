/**
 * Smoke spec: login as bob, walk the four main routes at both 390 and 1280,
 * and assert each page renders a non-empty #root.
 *
 * WHY THIS EXISTS:
 *   A broken context import (e.g. a bad provider rewire) produces a white screen
 *   in a real browser but passes all jsdom/unit tests.  This spec caught four
 *   such regressions that the ~191 unit tests did not.
 *
 * IGNORED NOISE:
 *   - 401 fetch responses while the 8 s access token refreshes — that is the app
 *     working correctly, not a failure.  They appear as console errors, not as
 *     uncaught JS exceptions (pageerror events), so asserting zero pageerrors is
 *     the right filter.
 *   - The known pre-existing MUI Tabs console.warn on /dashboard — it is a warn,
 *     not an error, so it does not trigger a pageerror.
 */
'use strict';

const { test, expect } = require('@playwright/test');

const ROUTES = [
    ['feed',      '/'],
    ['users',     '/users'],
    ['chat',      '/chat'],
    ['dashboard', '/dashboard'],
];

// Minimum #root inner-text length that proves the page rendered real content.
// A login redirect produces ~20 chars; any real page produces many more.
const MIN_ROOT_LEN = 40;

test.describe('Smoke: all main routes render at both viewports', () => {
    test('routes render non-empty #root with no uncaught page errors', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        // --- Login as bob ---
        await page.goto('/login');
        await page.fill('input[type="email"]',    'bob@verify.test');
        await page.fill('input[type="password"]', 'Password1!');
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20_000 });

        // --- Walk every route ---
        for (const [name, routePath] of ROUTES) {
            await page.goto(routePath, { waitUntil: 'networkidle' });
            // Give the React tree a moment to settle after network goes idle.
            await page.waitForTimeout(2_000);

            const rootLen = await page.evaluate(
                () => (document.getElementById('root')?.innerText ?? '').trim().length,
            );

            expect(rootLen, `${name}: #root has too little content (${rootLen} chars) — possible white-screen`)
                .toBeGreaterThan(MIN_ROOT_LEN);
        }

        // --- No uncaught JS errors ---
        // Filter: ignore errors that are purely about 401/network (expected during token
        // refresh), but keep any real JS exception.
        const realErrors = pageErrors.filter(
            msg => !/401|unauthorized|network\s+error/i.test(msg),
        );
        expect(realErrors, 'uncaught page errors').toHaveLength(0);
    });
});
