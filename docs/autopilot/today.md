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

## Tasks

TASK B (DMs silently stop working after a long session) is COMPLETE and moved to
"## Awaiting review" in backlog.md — built on `autopilot/2026-07-14`, commits `25decfc`
+ `00d1324`. Suites green (375/375 API, 190/190 web) and browser-verified at 390 and 1280.

**Phase D #16 (provider/hook cleanup) is COMPLETE** and moved to "## Awaiting review" —
commits `540f910`, `9d91b16`, `4126229`. Web lint 39 → 0, and `continue-on-error` is off:
web lint is now a HARD CI GATE. Root `npm run lint` / `npm run test` scripts added.
Found and fixed a real bug on the way (a chat draft could follow you into a different
person's conversation — `tests/ChatComposeBoxClears.test.jsx`).

### 1. Phase E (code parts only)
- What: Dockerized local env (Dockerfile + compose), Sentry wiring, and promote the untracked TASK-B harness into the CHECKED-IN Playwright smoke pack.
- Decisions: hosting, DNS, prod env vars and Render/Vercel/Cloudflare settings are Guardrail-7 STOP-AND-ASK — build only the CODE. The smoke pack must keep the TASK-B pattern (in-memory Mongo, tiny token TTL, real `setOffline` outage, reload-as-assertion).
- Done when: `docker compose up` boots api+web locally; Sentry initialises from env and is a no-op without a DSN; the smoke pack runs green from an npm script.
- Type: feature

---

## After this run (own orders, in this sequence)

1. **Phase E — deployment**: Dockerized local env · staging + prod hosting · Sentry · Playwright smoke pack · domain/HTTPS/deploy pipeline. Unlocks the **network/infra hardening** item.
   - The throwaway browser harness (now used FOUR times) should become the CHECKED-IN Playwright smoke pack here. It has caught four bugs that ~190 unit tests could not — TASK B is the clearest case yet: every unit test passed while DMs were silently dying in a real browser.
   - The TASK-B harness is still on disk, UNTRACKED — `apps/api/pw-boot.cjs`, `apps/web/pw-verify.cjs`, `apps/web/.env.pwverify`. Promote it, don't rewrite it. It needs `npm i --no-save playwright` to run (deliberately kept out of package.json).
   - The pattern worth keeping: real API + in-memory Mongo (NEVER Atlas, NEVER David's dev servers on 8181/5173), a deliberately tiny token TTL so "a long session" happens in seconds, a REAL network outage via `context.setOffline` long enough to outlast socket.io's ping cycle (25s + 20s), and a PAGE RELOAD as the assertion — a locally-rendered bubble proves nothing.
   - NOTE: hosting, DNS and prod env vars are Guardrail-7 "stop and ask" — the CODE parts (Dockerfile/compose, Sentry wiring, smoke pack) can be built on the branch; the account-level setup is David's.
2. **Admin analytics aggregation endpoints** — the debt taken deliberately in the provider-retirement run (the admin Overview panel still pulls both full collections on mount, admin-only).

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch. (`apps/agents` does not exist yet; `packages/shared` is still an empty .gitkeep.)
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.

## Housekeeping for the next run
- **`.gitattributes` is missing.** Windows git here has `core.autocrlf=true`, WSL git does not. Windows git sees a clean tree; WSL git sees ~110 files as modified — pure CRLF noise, byte-identical content. Harmless while every commit is made from Windows, but a commit made from inside WSL would produce a 110-file line-ending diff. Worth a `.gitattributes` (`* text=auto eol=lf`) before that happens.
- The two `.claude/hooks/*.py` files show as modified in a permanently-dirty way: it is a FILE-MODE change only (`100755 → 100644`, exec bit dropped by the WSL/Windows filesystem), zero content lines. Not anyone's edit; left untouched.
