# Autopilot — Today's Work

This file is the day's task list for the autopilot.
Each task = what to do + how to know it's done + a type tag.
Clear and rewrite it each day. Git keeps the history.

<!-- TASK FORMAT:
### Task title
- What: clear description of the change.
- Decisions: pre-answer any choices you care about (fields, behavior, look, edge cases). Anything not listed here, the agent decides itself and logs in its report.
- Done when: how to verify it's actually working.
- Type: logic | visual | feature
-->

## STATUS: TASK B is DONE — merged into `25decfc`, verified in a real browser.

All four tasks below are complete. Root cause proven, failing tests written first, minimal
fix landed, and the fix confirmed end-to-end in Chromium at 390 and 1280.

**Root cause (confirmed, not the whole hypothesis):** the hypothesis was right that the socket
never learns about a refreshed token — but the *silent* part had a second cause. socket.io
**silently buffers** an emit on a disconnected client. So a stale-token socket that the server
refused to re-handshake left `send-message` sitting in a client-side buffer forever: no throw,
no error event, no server round-trip. The message looked sent and never was.

**The fix (both halves shipped, as required):**
- `socketService.js` — auth is now a *callback*, so every reconnect re-reads the CURRENT token;
  on an auth-shaped `connect_error` it calls the (now exported) single-flight `refreshAccessToken()`
  and reconnects. One attempt per broken connection, so a dead session can't spin a refresh loop.
- `useChat.js` + `chatSocket.js` — a text DM is no longer fire-and-forget. It emits with an ack +
  10s timeout, and the server answers only once the message is actually stored. Disconnected, timed
  out, or rejected → the user is told. The Snackbar already existed; nothing was feeding it.

**Browser proof (same harness, same timings, only the fix differs):**

| | mobile 390 | desktop 1280 |
|---|---|---|
| reached the server — BEFORE the fix | **NO** (and no error shown) | **NO** (and no error shown) |
| reached the server — AFTER the fix | **YES** | **YES** |

The baseline run is the important half: the harness was first run against the *reverted* code and
the DM vanished silently at both viewports, exactly as reported. A verification that passes both
before and after the fix proves nothing.

Verified by: log in → let the 8s access token expire → 50s offline (long enough to outlast
socket.io's 25s ping + 20s timeout, so the socket genuinely DIES and reconnects with a stale
token) → send a DM → **reload the page**. The reload is the real assertion: a bubble rendered
locally proves nothing, since that is precisely what the bug looked like.

Suites green: **375/375 API**, **190/190 web** (incl. the 2 new chat tests, 4/4).

The throwaway harness (`apps/api/pw-boot.cjs`, `apps/web/pw-verify.cjs`, `apps/web/.env.pwverify`)
is intentionally left UNTRACKED on disk for Phase E to promote into the checked-in smoke pack —
it has now caught four bugs the unit tests could not, and rebuilding it a fifth time is waste.
It needs `npm i --no-save playwright` to run (deliberately not added to package.json).

---

## Plan — TASK B: DMs silently stop working after a long session

The last two runs (provider retirement → merged to main; folder/naming sweep → awaiting review) are finished. Next in the queue is the oldest un-actioned BUG in the backlog, and it's a bad one: it silently breaks the core messaging feature for anyone who leaves a tab open.

**Symptom:** after a long logged-in session the user can't send DMs. The send just… does nothing. No error, no toast, no retry. Logging out and back in fixes it.

**Working hypothesis (to confirm or refute BEFORE writing any fix):** the socket authenticates ONCE at connect, with whatever token was in localStorage at that moment. HTTP requests silently refresh the access token when it expires (apiService has a single-flight `/auth/refresh` + replay), but nothing tells the SOCKET about the new token — so the socket's captured token goes stale and the server rejects or drops the message, with nothing surfaced to the user. Logout+login recreates the socket with a fresh token, which is exactly why that "fixes" it.

**Discipline for this run (CLAUDE.md):** diagnose FIRST, read-only. Do not write a fix against a guess. Once the root cause is proven, write a FAILING TEST, then the minimal fix, then confirm the suite is green. A silent failure must end up loud — the user has to know a message didn't send.

---

## Tasks

### 1. Prove the root cause (read-only, no fix yet)
- What: Trace the DM send path end to end: the Socket.io auth handshake (is the token verified once at connect, or per event?), the client socket (is the token captured once in a closure, or re-read per emit? does it reconnect with a FRESH token?), how a message is actually sent (socket emit vs HTTP POST — this is the crux), and whether anything re-authenticates the socket after apiService refreshes the token. Find the JWT expiry — that's the "long session" threshold.
- Decisions: If the evidence contradicts the hypothesis above, FOLLOW THE EVIDENCE and log that. Do not force the hypothesis.
- Done when: the exact line where the message is dropped is identified, with the token lifetime that triggers it.
- Type: logic

### 2. Failing test first
- What: A test that reproduces the bug — a message sent with a token that has since expired must not be silently swallowed.
- Decisions: Prefer an API-level test (the server is where the message is dropped). It must FAIL against the current code — a test that passes before the fix proves nothing.
- Done when: the new test fails for the right reason, and the failure describes the real bug.
- Type: logic

### 3. The minimal fix
- What: Whatever task 1 proves. If the hypothesis holds, the shape is: keep the socket's credentials fresh (re-auth / reconnect the socket when the token refreshes), AND make the failure LOUD if a send is rejected — never a silent drop.
- Decisions: The silent failure is the actual defect here. Even with the auth fixed, a message that fails to send must surface to the user — the send path needs an ack/error, not fire-and-forget. Both halves ship.
- Done when: the failing test from task 2 passes; the full suites are green.
- Type: logic

### 4. Verify in a real browser
- What: A token-expiry bug can't be trusted to unit tests alone — it's a lifecycle bug spanning two transports.
- Decisions: Reuse the harness pattern (throwaway in-memory Mongo, NEVER Atlas, NEVER David's dev servers). Boot the API with a DELIBERATELY SHORT access-token lifetime so "a long session" happens in seconds, open the chat, let the token expire, then send a DM. It must arrive — or, if it genuinely cannot, it must tell the user.
- Done when: a DM sent after the access token has expired either arrives or raises a visible error — never silently vanishes. Verified at 390 and 1280.
- Type: visual

---

## After this run (own orders, in this sequence)

1. **Phase E — deployment**: Dockerized local env · staging + prod hosting · Sentry · Playwright smoke pack · domain/HTTPS/deploy pipeline. Unlocks the **network/infra hardening** item.
   - The throwaway browser harness (now used FOUR times) should become the CHECKED-IN Playwright smoke pack here. It has caught four bugs that ~190 unit tests could not — TASK B is the clearest case yet: every unit test passed while DMs were silently dying in a real browser. The TASK-B harness is still on disk, untracked (`apps/api/pw-boot.cjs`, `apps/web/pw-verify.cjs`, `apps/web/.env.pwverify`) — promote it, don't rewrite it. The pattern to keep: in-memory Mongo, a deliberately tiny token TTL, a real network outage via `context.setOffline`, and a RELOAD as the assertion.
   - NOTE: hosting, DNS and prod env vars are Guardrail-7 "stop and ask" — the CODE parts (Dockerfile/compose, Sentry wiring, smoke pack) can be built on the branch; the account-level setup is David's.
2. **Admin analytics aggregation endpoints** — the debt taken deliberately in the provider-retirement run (the admin Overview panel still pulls both full collections on mount, admin-only).

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch. (`apps/agents` does not exist yet; `packages/shared` is still an empty .gitkeep.)
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.
