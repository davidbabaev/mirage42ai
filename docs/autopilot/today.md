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

## Plan (2026-07-10) — recommended execution order

Working top-down. One concern per commit; test-first for logic; browser-verify visual at 390/1280; full suite green before "done".

### 1. Server-authoritative follower/following counts  [IN PROGRESS]
- What: The API must return `followersCount` and `followingCount` on the standard user/profile response instead of the client counting the full `following` array. Closes the remaining piece of master-plan Phase D #14.
- Decisions: `followingCount` = deduped `$size` of the `following` array; `followersCount` = `countDocuments({ following: id })` (or aggregation). Keep returning existing fields for now to avoid breaking callers; frontend profile switches to the server counts. Don't leak the full `following` array where only a count is needed (follow-up).
- Done when: profile fetch returns both counts; the public profile UI renders them from the server fields (not `new Set(following).size`); counts are correct across follow/unfollow; API tests cover both counts; full suite green.
- Type: logic

### 2. Vercel preview URLs blocked by CORS  [DONE]
- What: API CORS origin check also allows Vercel preview hostnames (`*.vercel.app` / per-branch preview URLs), not only the fixed production origin.
- Decisions: match the Vercel preview pattern safely (exact suffix match, not a loose regex); keep the production origin as the canonical anchor.
- Done when: a preview-style Origin passes CORS while an unknown origin is still rejected; covered by a test.
- Type: logic / config

### 3. Chat pagination — message list + conversation list  [3A message list DONE · 3B conversation list IN PROGRESS]
- What: Paginate the chat message list (reverse / load-older on scroll-up) and the conversation list, reusing the cursor-pagination util + InfiniteScroll pattern. Next phase of the infinite-scroll epic.
- Done when: opening a long thread loads a page of recent messages, scrolling up loads older; conversation list paginates; browser-verified at 390/1280; suite green.
- Type: feature

### 4. Admin panels — server-side paging
- What: Move admin lists (users/cards/reports) off client-side paging over admin-loaded data to server-side pagination.
- Done when: admin lists page from the server; suite green.
- Type: logic

### 5. Optimistic follow/like/comment mutations
- What: Make follow/like/comment update in place with no refetch/scroll-jump (the real fix). Evaluate whether to adopt React Query (#15) or extend the current hooks.
- Done when: actions reflect instantly, reconcile on server response, roll back on error; browser-verified.
- Type: logic

### 6. Retire global load-everything providers
- What: Remove `getAllUsers`/`getAllCards` mount-time full-collection loads once counts (#1) are server-side; anything still depending on them migrates to scoped/paginated queries.
- Done when: no provider loads a full collection on mount; suite green.
- Type: logic

### 7. Favorites → API (cross-device)
- What: Move `useFavoriteCards` from localStorage to a server-persisted API.
- Done when: favorites persist across devices/sessions; suite green.
- Type: feature

### 8. Folder / naming sweep
- What: One restructure — misspellings, casing, "reusable components" naming. Done LAST, after the architecture settles.
- Type: logic

### 9. Network / infra hardening  (deploy-time, not app code)
- What: Firewall / WAF (Cloudflare) / restrict inbound ports / lock Atlas network access. Verified in host dashboards.
- Type: infrastructure

### 10. TASK B — DMs fail after a long session  (DIAGNOSE-ONLY, separate session)
- What: After a long session DMs silently fail until relogin. Likely token/socket-auth expiry. Diagnose, do not implement here.
- Type: bug → diagnosis

---

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- 11. Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch.
- 12. One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- 13. In-character DMs with memory + human-feeling delays.
- 14. Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 15. 3-agent pilot on staging.

<!--
DECISIONS LOG (this run) — maintained by the executor, reviewed at merge:
- Task 3A (chat MESSAGE pagination): reused the existing `cursorPagination` util — `getMessages(convId, userId, {cursor,limit})` runs `runKeysetPage` (newest-first desc) and REVERSES each page to ascending for display, so the thread opens on the newest page and `nextCursor` points at the next-OLDER page. The per-side `deletedAt` floor and the cursor coexist under `$and` (util composes them). Added a `{conversationId,createdAt:-1,_id:-1}` index. Response shape changed bare-array → `{messages,nextCursor}` (matches feed/notifications); updated chat-delete test helper accordingly. Frontend: `useChat` gained reverse-pagination state (`olderCursor`, `loadingOlder`, `loadOlderMessages` which PREPENDS, guarded against stale conversation + de-duped). Scroll-anchoring on prepend via `useLayoutEffect` (save scrollHeight before load, shift scrollTop by the delta after) so the viewport never jumps; the append/auto-scroll effect now keys on TAIL identity (last msg id) to distinguish an append from a prepend. Mirrored in `useConversationThread` (dock). Top CircularProgress while loading older. 4 new API tests (cursor walks older, full-sequence reassembly, limit clamp, malformed→400); api 294 green + lint clean; web 161 green; browser-verified at 390/1280 (35-msg seeded thread: opens at newest 25, scroll-up prepends older with spinner, scrollTop == prepend delta so content stays anchored, no console errors, #1 reachable).
- Task 2 (Vercel preview CORS): added a shared `isOriginAllowed(origin)` in `config/allowedOrigins.js` used by BOTH the HTTP cors middleware and the socket.io cors (function form, so they can't drift). It allows exact static-allowlist origins plus origins matching an optional `PREVIEW_ORIGIN_REGEX` env. Chose a CONFIGURABLE, project-scoped regex over a blanket `*.vercel.app`: with `credentials:true`, reflecting every vercel.app origin would let any site on that platform make credentialed requests. Unset ⇒ no preview origins allowed (no behavior change for anyone not opting in). Invalid regex is caught and ignored (no crash, matching off). Requests with no Origin (curl/server-to-server/same-origin) still allowed. Documented in `.env.example`. 6 new unit tests; live-verified the function-form middleware still emits ACAO for allowed origins and omits it for disallowed.
- Task 1 (follower counts): computed server-side in `projectUser`. `followingCount` = deduped `$size` of the doc's `following` (free, always attached). `followersCount` = one `countDocuments` on the single endpoint and ONE aggregation over the result set on the list endpoint (getSuggestedUsers pattern — no N+1). Attached to BOTH `GET /users/:id` and each `GET /users` entry, because the profile page resolves `userProfile` from the global users list, not a dedicated single fetch — so counts had to ride the list to reach the profile without a data-flow rewrite. Frontend reads `userProfile?.followersCount/followingCount` with a graceful `??` fallback to the old client derivation (non-breaking if the field is ever absent). Followers/following LIST endpoints (getFollowers/getFollowing) intentionally NOT given followersCount (kept undefined so no wrong 0 is injected); they still get the free followingCount. Retiring the global users provider is a separate task (#6).
-->
