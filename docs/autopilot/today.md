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

<!--
DECISIONS LOG (this run) — maintained by the executor, reviewed at merge:
- Infinite-scroll task scoped to NOTIFICATIONS (phase 4) only for this run; chat + admin deferred to their own orders per backlog's "each needs their own order" note. Keeps the run reviewable and avoids one giant multi-area commit.
- Mobile post: single responsive CardItem via sx breakpoints (no useMediaQuery, no second component) to match the codebase's existing responsive convention.
- Notifications NOT made read-time block-aware: the block feature already suppresses notifications at CREATION time (see block-hardening test), so the read endpoint was never block-filtered; adding it is a separable concern and would grow this diff. Deferred, behaviour preserved.
- unreadCount split into its own state (was client-derived from the full 50-item array, which no longer exists under pagination). Server returns it on the first page over ALL rows; a monotonic token + optimistic clear on mark-read prevents a late first-page fetch from resurrecting a stale badge.
- Infinite-scroll backlog item kept under "## Active" (not moved to Awaiting review): it is a multi-phase epic and phases 1–3 were handled the same way — a "Progress:" line + updated "Still TODO", staying Active until chat + admin are also done.
-->
