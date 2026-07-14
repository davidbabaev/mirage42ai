# E2E smoke pack

Runs the full browser-level regression suite against a real API and real browser. Boots all servers automatically.

```
npm run test:e2e
```

That is the only command needed. Playwright starts the API server and the Vite dev server, runs both specs at both viewport sizes, and shuts everything down.

---

## What the pack does

### smoke.spec.js
Logs in as bob, navigates to `/`, `/users`, `/chat`, and `/dashboard` at both 390 px (mobile) and 1280 px (desktop), and asserts each page renders a non-empty `#root`.

**Why it exists:** A broken context import (e.g. a bad provider rewire) produces a white screen in a real browser but passes all jsdom/unit tests. This spec has caught four such regressions that the ~191 unit tests did not.

### chat-token-expiry.spec.js
The TASK-B regression test. Catches the bug where DMs were silently dropped after a long session.

**Sequence:**
1. Log in (access token TTL = 8 s in the harness)
2. Wait for the token to expire
3. Go offline for 50 s to kill the socket
4. Come back online and let the app reconnect
5. Send a DM
6. Reload — if the server stored the message it reappears; if not, the test fails

---

## The weird numbers, explained

| Setting | Value | Reason — do not change |
|---------|-------|------------------------|
| `ACCESS_TOKEN_TTL` | `8 s` | Makes a "long session" (normally ~15 min) happen in seconds |
| Offline duration | `50 s` | Must outlast socket.io's ping cycle: `pingInterval` (25 s) + `pingTimeout` (20 s) = 45 s. A shorter blip does NOT kill the socket; the emit just flushes on reconnect and the server never sees the stale-token handshake. The original debug attempt used a 2.5 s blip — it proved nothing. |
| Reload assertion | Required | A message that only appears in the local optimistic bubble before reload is NOT stored. That is exactly what the original bug looked like. Removing the reload guts the test. |

---

## Servers started automatically

| Server | Port | Details |
|--------|------|---------|
| Express API | 8182 | In-memory MongoDB (never touches Atlas), 8 s access-token TTL, seeded with users alice + bob + a conversation |
| Vite dev | 5174 | `VITE_API_URL=http://localhost:8182` — never touches the dev or production API |

Ports 8181 (dev API) and 5173 (dev Vite) are never touched.

---

## Viewports

Every spec runs at:
- **mobile-390** — 390 × 844 px
- **desktop-1280** — 1280 × 900 px

---

## CI integration

The pack is NOT wired into CI yet — browser binaries need to be pre-installed on the runner. To add it:

1. Add a CI step that runs `npx playwright install chromium` before `npm run test:e2e`.
2. Set `CI=true` in the environment (Playwright disables `reuseExistingServer` automatically).
3. Add the step after unit tests and before deploy.

---

## Bugs caught by this pack that unit tests missed

1. White screen from a bad context import after the provider/hook split (Phase D)
2. DMs silently dropped after token expiry (TASK-B) — the chat-token-expiry spec
3. Two additional white-screen regressions caught during the smoke walk

Unit test count: ~566 (375 API + 191 web). Zero of these caught the above bugs.
