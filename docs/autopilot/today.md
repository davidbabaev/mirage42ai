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

## Plan — the folder/naming sweep (master-plan #20)

Master-plan #20: *"Folder/file reorganization + naming sweep (the misspellings, casing, 'reusable components' space) — done LAST in D, when the architecture has settled. ONE restructure."*

The architecture has now settled: the provider-retirement epic is merged to main, so the file layout has stopped moving. This is that one restructure.

**Scope discipline.** This is a rename/cleanup pass — NO behavior changes, except where a "typo" turns out to be an actual bug (task 1). Each rename is its own commit so a bad one can be reverted alone. The full suites must stay green after every task.

**Deliberately OUT of scope** (organizational preference, not errors — churn without value):
- `components/chatDock/` — looks odd but actually FOLLOWS the convention (multi-word folders are camelCase).
- `pages/landing/` (a folder holding one file) and `pages/docs/pages/` (a redundant nesting). Harmless; leave them.

**RUN COMPLETE.** All 7 tasks done and committed on `autopilot/2026-07-13-restructure`; see backlog.md → "Awaiting review". api 375 green, web 186 green, browser-verified 12/12 surfaces with zero console errors.

---

## Tasks

(all done — see backlog.md)

## After this run (own orders, in this sequence)

1. **TASK B — DMs fail after a long session** — diagnose-only session (likely token/socket-auth expiry).
2. **Phase E — deployment**: Dockerized local env · staging + prod hosting · Sentry · Playwright smoke pack · domain/HTTPS/deploy pipeline. Unlocks the **network/infra hardening** item.
   - The throwaway browser harness (used twice now: merge-prep sweep, and task 7 above) should become the CHECKED-IN Playwright smoke pack here. It has caught two bugs that ~190 unit tests could not.
3. **Admin analytics aggregation endpoints** — the debt taken deliberately in the provider-retirement run.

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch. (`apps/agents` does not exist yet; `packages/shared` is still an empty .gitkeep.)
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.
