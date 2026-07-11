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

### 7. REMOVE the global loads — remaining inventory (the actual deletion)
DONE so far (this run): all sub-object embeds (notification sender, conversation participant, feed likePreview, comment/reply authors, postsCount, GET /cards/:id) + count hooks read the card object (6a) + getFollowersCount reads the user object (6b-part). Each was safe/additive — the global arrays are STILL loaded, so nothing is removed yet.

REMAINING before `getAllCards` (registeredCards) can be removed:
- **Card-author embed** (NOT yet done — discovered during slice 6): CardItem/CardDetailsModal/CardDetailsPage do `users.find(card.userId)` for the POST AUTHOR on every card. Embed `creator {_id,name,lastName,profilePicture,job}` on card payloads (like likePreview) and read it. This is BOTH a users-array AND per-card consumer — the single biggest remaining one.
- **Overlay-upsert mechanism**: handleToggleLike/handleAddComment/etc. currently `.map` registeredCards (update-in-place). With registeredCards empty they must UPSERT the card so the overlay (6a) reflects optimistic like/comment on non-feed surfaces. Requires toggleLike/mutations to pass the card object.
- **Posts tab** (UserProfileMain) + **MyCardsSection**: render a user's cards from `registeredCards.filter(userId)` → migrate to paginated `getExploreCards(cursor,limit,userId)`.
- **Own-user postsCount/followersCount**: the logged-in user object (login's pickSafeUserFields) omits them → own sidebar/dashboard falls back to the global arrays. Deliver them (add to pickSafeUserFields or a fresh getSingleUser(me) on login).
- **addAuthorToFeed** (follow): splices the followed user's posts from registeredCards → refetch the feed (or a user-posts endpoint) instead.

REMAINING before `getAllUsers` (users) can be removed:
- Card-author embed (above) removes the biggest one.
- **Profile resolution** (UserProfileLayout/Main/About/Media/Followers): resolve the subject via `getSingleUser(id)` instead of `users.find`.
- **AllCardsPage creator filter**: async `searchUsers(q)` instead of client-filtering the full users list.
- **PYMK / mutual friends** (FeedPage, UserProfileMain): `users.filter(following ids)` → a suggestions/mutual endpoint (getSuggestedUsers exists; mutual needs getFollowing intersection).
- **toggleFollow optimistic update**: uses `syncUser` to patch the users array → needs a user-overlay equivalent so follow counts still reflect cross-surface.
- **Admin analytics** (useAnalytics): 13 passes over the full users+cards arrays → dedicated server analytics endpoints, OR make the admin OverView panel fetch getAllUsers/getAllCards ON DEMAND (admin-only, panel mount) so the providers no longer load them for everyone at app mount.

FINALLY: once every consumer above is migrated, delete the mount-time `getAllUsers`/`getAllCards` from UsersProvider/CardsProvider (registeredCards becomes the empty-start mutation overlay). Verify the network tab on login shows NO `GET /users` / `GET /cards`. Master-plan #15/#16 also want React Query (`useInfiniteQuery` feed) — optional; the overlay approach above achieves #4 (no full-collection mount load) without it, and is more reversible.
- Type: logic — this is a large coordinated change; do it as its own focused session (the embeds/decoupling groundwork above is already committed on autopilot/2026-07-11-2).

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
