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

## Plan — retire the load-everything providers (master-plan #15/#16/#4)

Working top-down. One concern per commit; test-first for logic; browser-verify visual at 390/1280; full suite green before "done".

**Goal of this run:** kill the two unbounded mount-time loads — `getAllUsers` (`GET /users` → ALL users) and `getAllCards` (`GET /cards` → ALL cards / `registeredCards`) — WITHOUT regressions. Strategy = server-embed the sub-objects each consumer needs, endpoint-by-endpoint, so the app stays green at every step; only remove the global loads in the LAST task, once nothing reads them. Full blocker list lives in `backlog.md` ("Infinite scroll" epic). Do NOT big-bang this.

### 3. Embed top-N liker objects on feed/card payloads
- What: feed + card responses embed the first ~4 liker user objects (`likePreview`) so `CardItem.jsx` / `CardDetailsModal.jsx` render the avatar strip without `users.filter(u => card.likes.includes(u._id))`. (LikesModal already uses the scoped `getCardLikes` endpoint — leave it.)
- Done when: liker avatars render on feed cards with `users` empty; keeps working after an optimistic like; API test; browser-verified; suite green.
- Type: feature

### 4. Embed commenter / reply-author in comment objects
- What: comment + reply objects carry their author `{ _id, name, lastName, profilePicture }`; `CardsComments.jsx` reads that instead of `users.find` per comment/reply.
- Done when: comments/replies show author with `users` empty; API test; browser-verified; suite green.
- Type: feature

### 5. Server-embed postsCount on user objects + activate GET /cards/:id
- What: add `postsCount` to the user projection (aggregation, no N+1) so the 6+ "N posts" displays stop doing `registeredCards.filter(c => c.userId===id).length`. Activate the (already server-side, commented-out) `GET /cards/:id` in apiService for `CardDetailsPage`/`CardDetailsModal` to resolve a card by id instead of scanning `registeredCards` (also fixes the deep-link "skeleton forever" bug). Keep optimistic-like state live in the detail view.
- Done when: post counts + card-detail views work with `registeredCards` empty; API tests; browser-verified; suite green.
- Type: logic

### 6. Decouple like/comment count hooks + profile resolution from the global arrays
- What: refactor `useLikedCards` / `useCommentsCards` so `isLikeByMe` / `getLikeCount` / `countComments` read from the card object (feedCards already carries `likes`/`comments`) rather than `registeredCards.find`. Profile sub-routes (`UserProfileLayout/Main/About/Media/Followers`) resolve the subject via `getSingleUser(id)` instead of `users.find`. `UserProfileMain` posts tab uses paginated `getExploreCards(cursor,limit,userId)`. `addAuthorToFeed` (follow) fetches the followed user's posts via the user-posts endpoint instead of splicing from `registeredCards`.
- Done when: like/comment counts, profiles, and follow-adds-posts all work with both global arrays empty; tests updated; browser-verified; suite green.
- Type: logic

### 7. Adopt React Query for the feed + REMOVE the global loads
- What: add `@tanstack/react-query`; migrate the feed to `useInfiniteQuery` (load-more, 20–30/page); with tasks 1–6 done, DELETE the `getAllUsers`/`getAllCards` mount-time loads from UsersProvider/CardsProvider (and the now-dead client-side join/filter code — master-plan #16). Admin analytics (`useAnalytics`) moves to server aggregation endpoints (or is explicitly scoped out for this run if too big).
- Done when: NO provider loads a full collection on mount (verify the network tab on login shows no `GET /users` / `GET /cards`); suite green; browser-verified 390/1280.
- Type: logic

---

## After this run (own orders)

- **Folder / naming sweep** (master-plan #20) — one restructure, done LAST once the above settles the file layout.
- **TASK B — DMs fail after a long session** — diagnose-only session (likely token/socket-auth expiry).
- **Phase E — deployment**: Dockerized local env · staging + prod hosting · Sentry · Playwright smoke pack · domain/HTTPS/deploy pipeline. Unlocks the **network/infra hardening** item (firewall/WAF/Atlas lockdown — done in host dashboards).

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch.
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.
