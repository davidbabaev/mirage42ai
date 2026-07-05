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

### Mobile-native post layout (Instagram/Facebook-style feed on mobile)
- What: Feed posts must look mobile-native on phones and stay the current card on desktop. Today they render identically at every width — a bordered, rounded `Box` (border 0.5px, borderRadius 3, my:2) inset inside the Container gutter. On mobile that reads as a cramped desktop card, not an Instagram/Facebook feed. Make the feed post responsive in `apps/web/src/components/CardItem.jsx` (and the minimum needed in `apps/web/src/pages/FeedPage.jsx` to let it go full-bleed) so that:
  - **Mobile (xs, <900px):** the post is edge-to-edge. No side border, no rounded corners (`border` none, `borderRadius` 0). The media (`MediaDisplay` in CardItem) spans the FULL screen width, flush to both edges — it must escape the Container/Grid horizontal gutter, not sit inset with white rails. Header (avatar/name/menu), caption, counts and the action row keep a comfortable horizontal padding (~12–16px) so text isn't flush to the glass, but the media itself is full-bleed. Posts are separated by a thin `divider`-coloured separator and a small neutral gap (Facebook-style) instead of the floating rounded card — no rounded corners peeking. Header/caption/action spacing tightened so it reads as a native mobile feed, not a shrunk desktop card.
  - **Desktop (md+, ≥900px):** unchanged from today — bordered (0.5px divider), rounded (borderRadius 3), `my:2` floating card inside the centre `md:6` column.
  - Keep ONE `CardItem` component; drive the difference with MUI responsive `sx` (`{xs:..., md:...}`), matching the codebase's existing responsive pattern. Do NOT add `useMediaQuery` (the app uses sx breakpoints everywhere for layout). Do NOT create a second post component.
- Decisions (pre-answered — decide-and-continue, don't stop to ask):
  - Reference: Instagram feed (edge-to-edge media, minimal chrome) blended with Facebook mobile (thin grey separation between posts). Media flush to screen edges; text content keeps side padding.
  - Full-bleed mechanism: executor's call — either drop the Container/Grid horizontal gutter for the centre feed column on xs (e.g. `disableGutters`/`px:0` at xs on the feed column only) or give the media a mobile-only negative horizontal margin that exactly cancels the gutter. Whichever is cleaner and doesn't disturb the left/right sidebars or the desktop layout. The MobileSuggestions strip and PYMK sidebar must not shift or overflow.
  - Media crop on mobile stays the existing `objectFit:'cover'`, `objectPosition:'top'`, `maxHeight:600` — full-bleed width, not a new aspect-ratio system. Post-detail modal is NOT touched.
  - No theme changes; use existing tokens (`divider`, `background.paper`, default spacing/breakpoints).
- Done when (behavioural, browser-verified — NOT "tests pass"):
  - At 390px: feed media runs edge-to-edge with NO white side rails and NO rounded corners / card border on the post; posts are separated by a thin line/gap; header, caption and actions still have comfortable side padding; nothing overflows horizontally (no page-level horizontal scroll).
  - At 1280px: the post is visually unchanged from current `main` — bordered, rounded, floating card in the centre column; sidebars intact.
  - The MobileSuggestions strip (mobile) and People-You-May-Know sidebar (desktop) still render correctly and don't shift/overflow.
  - Screenshots captured at 390px and 1280px showing the two layouts.
- Type: visual

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
