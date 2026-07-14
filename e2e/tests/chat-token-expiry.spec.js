/**
 * TASK-B regression: DM persists after token expiry + socket death + reload.
 *
 * WHY THIS EXISTS:
 *   After ~15 minutes the access token expired, the socket reconnected with a
 *   stale token, and every DM sent in that session was silently dropped — it
 *   appeared in the local bubble but was never stored on the server.  The user
 *   had no idea; a reload showed the message was gone.
 *
 * HOW IT REPRODUCES THE BUG:
 *   1. Log in (access token TTL = 8 s in the harness, so "a long session"
 *      takes seconds, not hours).
 *   2. Wait 11 s — token has expired.
 *   3. Go offline for 50 s.  This is the critical number:
 *        socket.io default pingInterval = 25 s
 *        socket.io default pingTimeout  = 20 s
 *        total before socket dies       = 45 s
 *      A shorter blip does NOT kill the socket; the emit flushes on reconnect
 *      and the server never sees the stale-token handshake.  That is why 2.5 s
 *      offline proved nothing on the first debugging attempt.
 *   4. Come back online — the app must notice, refresh the token, and reconnect.
 *   5. Send a DM.
 *   6. RELOAD.  If the server stored the message it reappears; if not — the bug.
 *
 * THE ASSERTION:
 *   A message that only appeared in the local optimistic bubble BEFORE the reload
 *   is NOT stored.  That is exactly what the original bug looked like.  The reload
 *   is the only trustworthy assertion.
 *
 *   We also accept a visible error message from the app (e.g. "message not sent")
 *   as a passing outcome — the app told the user, which is correct UX.
 *
 *   The ONLY failure is a silent vanish: the message appeared to send but
 *   disappeared after reload with no error shown.
 *
 * DO NOT SHORTEN:
 *   - The offline window (50 s) — see reason above.
 *   - The ACCESS_TOKEN_TTL (8 s) — set in e2e/support/api-server.cjs.
 *   - The reload assertion — removing it guts the test; see note above.
 */
'use strict';

const { test, expect } = require('@playwright/test');

test.describe('TASK-B regression: DM survives token expiry + socket death', () => {
    // Total expected wait: 11 s (token) + 50 s (offline) + 10 s (reconnect) + margins ≈ 80 s.
    // Set a generous budget so a slow CI host does not time-out on the sleep intervals.
    test.setTimeout(180_000);

    test('message sent after reconnect is still there after reload', async ({ page, context }, testInfo) => {
        // Unique per viewport-run so the mobile and desktop passes don't mistake
        // each other's messages for a successful persistence.
        const MSG = `task-b-${testInfo.project.name}-${Date.now()}`;

        // --- Login as bob ---
        await page.goto('/login');
        await page.fill('input[type="email"]',    'bob@verify.test');
        await page.fill('input[type="password"]', 'Password1!');
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20_000 });

        // --- Open the chat page ---
        await page.goto('/chat', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2_500);

        // Open the Alice thread.  On mobile the conversation list is the default
        // view; on desktop we click the entry.  Either way, proceed if we can't
        // find the element — the message box check below will surface the real issue.
        try {
            await page.getByText(/Alice/i).first().click({ timeout: 8_000 });
        } catch {
            // Layout may differ by viewport — continue
        }
        await page.waitForTimeout(1_500);

        // --- Let the 8 s access token expire ---
        // 11 s gives a comfortable margin over the 8 s TTL.
        await page.waitForTimeout(11_000);

        // --- Simulate a real network outage long enough to kill the socket ---
        // pingInterval (25 s) + pingTimeout (20 s) = 45 s before the socket dies.
        // We hold for 50 s to be certain.  Do NOT shorten this.
        await context.setOffline(true);
        await page.waitForTimeout(50_000);
        await context.setOffline(false);
        // Give the app time to detect reconnection, refresh the token, and re-auth
        // the socket before we attempt to send.
        await page.waitForTimeout(10_000);

        // --- Send the DM ---
        const msgBox = page.getByPlaceholder(/message|write|type/i).first();
        let sent = false;
        try {
            await msgBox.fill(MSG, { timeout: 8_000 });
            await msgBox.press('Enter');
            sent = true;
        } catch {
            // Could not locate the input — recorded below
        }

        // If we could not even find the message box the test infrastructure is broken.
        expect(sent, 'Could not find the message input on /chat — check that the page renders correctly for this viewport').toBe(true);

        await page.waitForTimeout(4_000);

        // Note whether the app surfaced a visible error (acceptable outcome).
        const bodyBeforeReload = await page.textContent('body').catch(() => '');
        const visibleError = /not sent|offline|did not respond/i.test(bodyBeforeReload);

        // --- THE CORE ASSERTION: reload and check server-side persistence ---
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2_500);

        try {
            await page.getByText(/Alice/i).first().click({ timeout: 8_000 });
        } catch { /* ok */ }
        await page.waitForTimeout(3_000);

        const bodyAfterReload = await page.textContent('body').catch(() => '');
        const persisted = bodyAfterReload.includes(MSG);

        // PASS:  message was stored by the server (persisted after reload), OR
        //        the app told the user it failed (visible error shown).
        // FAIL:  message appeared to send but silently vanished — the TASK-B bug.
        expect(
            persisted || visibleError,
            `Message "${MSG}" was neither persisted on the server nor surfaced as an error. ` +
            `This is the TASK-B regression: DMs silently dropped after token expiry + socket death.`,
        ).toBe(true);
    });
});
