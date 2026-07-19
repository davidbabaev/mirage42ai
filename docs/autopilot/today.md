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

## Done this run — branch `autopilot/2026-07-19-2` (awaiting review)

**Phase F increment F2 — one agent persona + agent authentication.** In
backlog.md under "## Awaiting review". Four commits, one concern each:

1. **`b379483`** — the `AgentPersona` model. Three of its validations are
   safety rails, not formatting: **age min 18**, active hours that may wrap
   midnight, and budget caps that cannot go negative.
2. **`6fbf0c0`** — agent #1 seeded: **Maya Ben-Ari**, married on purpose (the
   plan's headline test case is her declining an advance). Her account is an
   ordinary user; `kind:'agent'` is the only difference, and the suite proves
   another human cannot tell.
3. **`6121612`** — silence a mongoose 9 deprecation in the seed.
4. **`f284cb1`** — the worker authenticates over `POST /users/login`, the same
   route a human uses, and stops there.

Gates: **0 lint errors · shared 4 · api 422 · web 193 · agents 34**.

### Verified end-to-end, not just with mocks
Every unit test injects a fake fetch, which proves wiring but not that the agent
can actually log in. So the REAL worker process was run against the REAL API
(in-memory mongo, never Atlas): `POST /users/login 200` → `agent maya ben-ari
authenticated`. Disabled made **no HTTP request at all**. A wrong password gave
a real 401, exit 1, and no password anywhere in the output.

### The one to fix with F3, not after
The worker logs in once and holds a **15-minute** access token, discarding the
refresh cookie entirely. The moment F3 makes it long-running it will start
401ing after fifteen minutes. This is the same shape as TASK B — the DM socket
that never learned about a refreshed token — and that one was silent for weeks.

## Done previously — branch `autopilot/2026-07-19` (MERGED to main as 2da263b)

**Phase F increment F1 — agent data model + runtime skeleton.** In backlog.md
under "## Done". Four commits, one concern each:

1. **`68c899f`** — `packages/shared` gets its first real export, `ACCOUNT_KIND`.
   Imported by BOTH the API model and the agents worker, so the two cannot drift.
2. **`c8b6148`** — `User.kind` ('human' | 'agent', default human) + migration 004.
   Owner and admin see it; no other user does.
3. **`6469a2d`** — ⚠️ **a critical pre-existing hole found on the way**:
   `PUT /users/:id` spread `...req.body` into `findByIdAndUpdate`, so any
   logged-in user could make themselves an admin. See below.
4. **`651a455`** — `apps/agents` skeleton: kill-switch, one log line, exit 0.

Gates: **0 lint errors · shared 4 · api 392 · web 193 · agents 9**.

### ⚠️ Read this one at review: privilege escalation, live on main today
`PUT /users/:id` authorised WHO you are (self or admin) but never WHICH fields
you could touch, and spread the whole body into the update. So:

    PUT /users/<my-own-id>  isAdmin=true  ->  I am now an admin

The same hole allowed self-unbanning, storing a PLAINTEXT password (the update
path never hashes), and overwriting `googleId` (OAuth account takeover). It is
unrelated to Phase F — but `kind` would have landed on the same surface, so it
is fixed here rather than inherited. Fix is a 12-field allowlist; proven by
running the new tests against the unfixed route (5 of 6 fail).

### Note for whoever runs this next
`npm install` **must be run from inside WSL**, not Windows PowerShell. Over the
`\\wsl.localhost` UNC path npm mangles the workspace symlink target and dies
with `EISDIR`. This bites as soon as a workspace has real dependencies, which
it now does.

## Done previously — branch `autopilot/2026-07-14`

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

## Phase F — Agents (the product vision)
- ~~Data model (`kind`) + `apps/agents` skeleton + kill-switch.~~ **F1 DONE, merged to main as 2da263b.** F1 covered `kind`, the skeleton and the kill-switch only.
- ~~`AgentPersona` + one seeded persona + agent authentication.~~ **F2 done, awaiting review** (branch `autopilot/2026-07-19-2`). Still to come from §5: the `AgentMemory` collection.
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API. **NEXT.** Start with token refresh (see backlog) — the worker holds a 15-minute token today and will 401 as soon as it is long-running.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.
