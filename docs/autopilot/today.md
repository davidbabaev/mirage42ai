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

## Plan — FINISH the provider retirement (master-plan #15/#16/#4), then clear the small-bug tail

**Context.** Slices 1–6 (server-embed sub-objects) are committed on `autopilot/2026-07-11-2` and awaiting review. They were all ADDITIVE — the two unbounded mount-time loads are still there. This run does the rest: migrate every remaining consumer off the global arrays, THEN delete the loads.

**Goal:** on login, the network tab shows NO `GET /users` and NO `GET /cards`. `registeredCards` becomes an empty-start mutation overlay; `users` goes away.

**Order matters.** Tasks 1–10 each remove one consumer of a global array and are individually safe (the arrays are still loaded, so every step stays green). Task 11 is the actual deletion and only works once 1–10 are done. Tasks 12–14 are the known small-bug tail, cheap and independent.

**Not in this run (human gate):** merging `autopilot/2026-07-11` + `autopilot/2026-07-11-2` to main. Autopilot never touches main — David does that at the merge gate.

**Deliberately deferred:** React Query (#15). The overlay approach achieves #4 without it and is more reversible. Do not adopt it here.

---

## Tasks

### 12. CardDetailsPage has no route
- What: `CardDetailsPage` is imported in App.jsx but has NO registered `<Route>`, so its deep-link path is unreachable. (Card detail currently works only via the modal.)
- Decisions: Wire the route (`/card/:id`) rather than deleting the page — a shareable, deep-linkable post URL is table stakes for a social app and the OG-share route already points people at post URLs. Reuse the page as-is; it already fetches by id since slice 5.
- Done when: navigating directly to a post URL renders the post (and a not-found state for a bad id). Browser-verify at 390/1280.
- Type: logic

### 13. Save button renders on a banned post
- What: The save/favorite button still renders on a BANNED post (only admins see banned posts in-feed); clicking it 404s and the optimistic add reverts silently.
- Decisions: Hide the save button when `card.status !== 'active'` in CardItem. Hide, not disable — a disabled control on a banned post is noise.
- Done when: no save button on a banned post; still present and working on active posts.
- Type: visual

### 14. `?card=` deep-link modal won't close
- What: A post modal opened via a `?card=` deep-link URL on `/allcards` doesn't close on the X — a sync effect re-applies the query param. Normal tap-to-open closes fine.
- Decisions: On close, clear the `card` param from the URL (replace, not push, so Back doesn't reopen it) and gate the sync effect so it only opens from the param on mount / param CHANGE, not on every render.
- Done when: opening a post from a `?card=` URL and clicking X closes the modal and leaves the param cleared; Back doesn't reopen it. Browser-verify at 390/1280.
- Type: logic

---

## After this run (own orders, in this sequence)

1. **MERGE GATE (David).** Review + merge `autopilot/2026-07-11`, `autopilot/2026-07-11-2`, and this run's branch to main. 20+ commits are stacked and unmerged — land them before more work piles on.
2. **Folder / naming sweep** (master-plan #20) — one restructure, done LAST once the architecture above has settled the file layout.
3. **TASK B — DMs fail after a long session** — diagnose-only session (likely token/socket-auth expiry).
4. **Phase E — deployment**: Dockerized local env · staging + prod hosting · Sentry · Playwright smoke pack · domain/HTTPS/deploy pipeline. Unlocks the **network/infra hardening** item (firewall/WAF/Atlas lockdown — done in host dashboards).
   - Do this BEFORE Phase F. Agents are API clients; running autonomous agents against a system with no staging, no error monitoring and no smoke tests means finding out about bugs from users instead of Sentry.
5. **Admin analytics aggregation endpoints** — the proper fix deferred in task 10.

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch. (`apps/agents` does not exist yet; `packages/shared` is still an empty .gitkeep.)
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.
