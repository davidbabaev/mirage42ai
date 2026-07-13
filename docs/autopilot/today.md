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

### 3. Posts tab + MyCardsSection — paginate off the server
- What: UserProfileMain's posts tab and MyCardsSection render a user's cards via `registeredCards.filter(c => c.userId === id)`. Migrate both to the paginated `getExploreCards(cursor, limit, userId)` endpoint (it already exists).
- Decisions: Reuse the existing `useCursorPagination` hook + `<InfiniteScroll>` primitive — same pattern as the profile media grid / followers list. Do not hand-roll pagination. Loading skeleton + empty state + end state, consistent with the other paginated lists.
- Done when: a profile with >1 page of posts scrolls and auto-loads page 2; the tab renders correctly with `registeredCards` empty. Browser-verify at 390/1280.
- Type: logic

### 4. Own-user postsCount / followersCount on login
- What: The logged-in user object (from login's `pickSafeUserFields`) has no `postsCount`/`followersCount`, so the OWN sidebar/dashboard counts fall back to the global arrays.
- Decisions: Add both to `pickSafeUserFields` server-side (cheapest, one place, mirrors what the user-list endpoints already embed) rather than firing an extra `getSingleUser(me)` round-trip on every login. Keep the counts fresh on mutation the same way the profile already does.
- Done when: own post/follower counts render correctly with both global arrays empty; API test asserts login response carries both fields. Browser-verify at 390/1280.
- Type: logic

### 5. addAuthorToFeed (follow) — stop splicing from registeredCards
- What: On follow, `addAuthorToFeed` splices the followed user's posts out of `registeredCards` into the feed. With the array empty there's nothing to splice.
- Decisions: Replace with a call to the existing user-posts endpoint (`getExploreCards(cursor, limit, userId)`) and merge the first page into the feed, preserving the existing no-refetch / no-scroll-jump behavior. If merging cleanly proves fragile, fall back to a feed refetch and LOG that choice — correctness beats the optimization here.
- Done when: following a user still surfaces their posts in the feed without a full-page reload or scroll jump, with `registeredCards` empty. Browser-verify at 390/1280.
- Type: logic

### 6. Profile resolution — `getSingleUser(id)` instead of `users.find`
- What: UserProfileLayout / Main / About / Media / Followers all resolve the profile subject via `users.find(id)`.
- Decisions: Resolve once at the layout level via `getSingleUser(id)` and pass the subject down to the sub-routes — do NOT fetch the same user five times, one per sub-route. Skeleton while loading, "user not found" on 404 (no perpetual skeleton — same bug class slice 5 fixed for cards).
- Done when: all five profile sub-routes render with the users array empty; a 404 shows not-found rather than hanging. Browser-verify at 390/1280.
- Type: logic

### 7. AllCardsPage creator filter — async search
- What: The creator filter client-filters the FULL users list. Assume 100k+ users — that never scales.
- Decisions: Use the existing `searchUsers(q)` / `GET /users/search` endpoint with a debounced async autocomplete, matching the admin panel's creator-search pattern shipped in sweep phase 7. Never a dropdown over all users.
- Done when: typing a creator name queries the server and narrows the posts list; works with the users array empty. Browser-verify at 390/1280.
- Type: logic

### 8. PYMK / mutual friends — server-side
- What: FeedPage and UserProfileMain compute "people you may know" / mutual friends by `users.filter(...)` over the global array.
- Decisions: `getSuggestedUsers` already exists — use it for PYMK. For MUTUAL friends, add a server endpoint (e.g. `GET /users/:id/mutual`) that intersects the two following sets server-side with one query — do not pull both lists to the client and intersect there. Paginate it like the other people lists.
- Done when: both surfaces render with the users array empty; API test covers the mutual intersection (including the empty case). Browser-verify at 390/1280.
- Type: logic

### 9. toggleFollow optimistic update — user overlay
- What: `toggleFollow` calls `syncUser` to patch the global users array so follow counts stay consistent across surfaces. That mechanism dies with the array.
- Decisions: Introduce a small user-overlay in UsersProvider (the same shape as the card overlay: a map of id → patched user, empty at start) that mutations write to and consumers read through with `overlay[id] ?? serverUser`. Keep follow optimistic — do not regress it to await-then-refetch.
- Done when: following from the feed updates the follower count on the profile and in the sidebar without a refetch, with no global users array. Web test covers the cross-surface case. Browser-verify at 390/1280.
- Type: logic

### 10. Admin analytics — fetch on demand, not at app mount
- What: `useAnalytics` makes 13 passes over the full users+cards arrays. It's the last consumer forcing EVERY user to load both collections at mount — for an admin-only panel.
- Decisions: Do NOT build the full server-aggregation endpoint suite in this run — that's a bigger piece of work and it is not on the critical path. Instead make the admin OverView panel fetch `getAllUsers`/`getAllCards` ON DEMAND at panel mount (admin-only, admin-guarded), so the providers stop loading them for everyone. Log this as a deliberate interim step and leave a backlog item for the proper aggregation endpoints. Rationale: it unblocks task 11 today, is fully reversible, and the cost lands only on the handful of admins who open that panel.
- Done when: the admin OverView panel still renders correct analytics, and its data loads only when the panel mounts (not at app mount). Browser-verify at 390/1280.
- Type: logic

### 11. THE DELETION — remove the mount-time global loads
- What: Delete the mount-time `getAllUsers` from UsersProvider and `getAllCards` from CardsProvider. `registeredCards` becomes the empty-start mutation overlay; the users array goes away (or becomes the overlay from task 9). Remove the now-dead `?? users.find(...)` / `?? registeredCards.filter(...)` fallbacks left behind by tasks 1–10.
- Decisions: This is the payoff task — do it only after 1–10 are green. If any consumer is still reading a global array, fix that consumer rather than keeping the load.
- Done when: **on login the network tab shows NO `GET /users` and NO `GET /cards`** — verify in the browser, not just in tests. Feed, profile, chat, notifications, admin, all-users and all-posts pages all still work at 390/1280 with zero console errors. Full API + web suites green.
- Type: logic

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
