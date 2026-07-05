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

### Infinite scroll across list pages — Phase 4: notifications list
- What: Continue the pagination sweep (phases 1–3 done — see backlog). This run covers the NOTIFICATIONS list only. The notifications backend currently hard-caps at 50 items and the panel loads them all at once. Give it cursor pagination consistent with the rest of the sweep: add a cursor param to the notifications endpoint returning `{ items, nextCursor }` (newest-first, block-aware, same opaque-cursor shape as the other sweep endpoints), and wire the notifications panel/dropdown to the existing `useCursorPagination` hook + `<InfiniteScroll>` primitive (spinner + IntersectionObserver, with the panel's own scroll container as the observer root). Remove the hard 50 cap so older notifications become reachable by scrolling.
- Decisions (pre-answered):
  - Reuse the existing sweep infra: `cursorPagination.js` backend util, `useCursorPagination` hook, `<InfiniteScroll>` primitive — do NOT build a new pattern (backlog: "DO NOT build ad-hoc").
  - Page size 20, newest-first. Cursor is opaque base64url over the same keyset used by the other endpoints.
  - Real-time: a newly-arrived notification (socket push / optimistic) prepends into the loaded window without pulling the un-loaded backlog — mirror the comments-pagination reconciliation approach (phase 3).
  - Mark-all-read / unread-badge behaviour is unchanged; only the list gains pagination.
  - Scope: notifications ONLY this run. Chat message history + conversation list, and admin panels, stay in the backlog as their own future orders (each "needs their own order" per the backlog note).
- Done when:
  - `npm run lint` clean and the API test suite green, INCLUDING a new test covering the paginated notifications endpoint (first page + nextCursor + past-50 reachability + block-aware).
  - In the browser: the notifications panel loads a first page; scrolling to the bottom auto-loads the next page with a spinner; more than 50 notifications are reachable by scrolling; a freshly-arrived notification still appears at the top.
  - Correct at 390px and 1280px (panel scrolls and paginates in both); screenshots captured.
- Type: logic

<!--
DECISIONS LOG (this run) — maintained by the executor, reviewed at merge:
- Infinite-scroll task scoped to NOTIFICATIONS (phase 4) only for this run; chat + admin deferred to their own orders per backlog's "each needs their own order" note. Keeps the run reviewable and avoids one giant multi-area commit.
- Mobile post: single responsive CardItem via sx breakpoints (no useMediaQuery, no second component) to match the codebase's existing responsive convention.
-->
