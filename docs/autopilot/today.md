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

(empty — everything queued for this run is finished and awaiting review)

## Done this run — branch `autopilot/2026-07-14`

All three items are in backlog.md under "## Awaiting review".

1. **TASK B — DMs silently died after a long session** (`25decfc`, `00d1324`, `402ce64`)
   Two causes, not one: the socket never learned about a refreshed token, AND socket.io
   silently buffers an emit on a disconnected client — so the message sat in a client-side
   buffer forever with no throw and no error. Both halves fixed. Browser-proved: the DM
   vanished silently BEFORE the fix and survives a reload AFTER it, at 390 and 1280.

2. **Phase D #16 — provider/hook cleanup** (`540f910`, `9d91b16`, `4126229`, `ddea9bc`)
   Web lint 39 → 0, and `continue-on-error` is now OFF in ci.yml: web lint is a HARD GATE.
   Found a real bug on the way — a chat draft typed to one person could follow you into a
   different person's conversation (`tests/ChatComposeBoxClears.test.jsx`).

3. **Phase E — the CODE half** (`e2527a8`, `0f82391`, `4ad8f6d`)
   Docker local env · checked-in Playwright smoke pack · Sentry (inert without a DSN) ·
   a real `.env.example` · the root ErrorBoundary the app never had.

Gates: **0 lint errors · 377/377 API · 193/193 web · e2e 4/4** (2 specs × 2 viewports).

## ⚠️ The one thing NOT verified
`docker compose up` has **never been run** — docker is not installed in the agent
environment. The compose file parses and every path it references exists, and that is all
that can be honestly claimed. Build it once on a machine with docker before trusting it.

## Next up (in this sequence)

1. **Phase E — the half that is David's** (Guardrail 7, needs a human):
   staging + prod hosting, DNS/Cloudflare, HTTPS, production env vars, the real Sentry DSN.
   Then the **network/infra hardening** item unlocks.
   - Also a human call: wiring `npm run test:e2e` into CI. It needs a browser-download step
     (`npx playwright install chromium`) and adds a few minutes to the run. See e2e/README.md.
2. **Admin analytics aggregation endpoints** — the debt taken deliberately in the
   provider-retirement run: the admin Overview panel still pulls BOTH full collections on
   mount and computes ~13 analytics passes in the browser. Fine at today's size; it does not
   survive 100k users. Replace with `$facet` aggregations behind the admin guard.
3. The small deferred follow-ups now listed under "## Active" in backlog.md (the
   ProfileSection `<EditProfileForm>` extraction, PeopleModal, the MUI Tabs warning on
   /dashboard, and the missing `.gitattributes`).

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch. (`apps/agents` does not exist yet; `packages/shared` is still an empty .gitkeep.)
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.
