# Mirage42 — Backlog

Everything we might work on. Add freely. I pull from here into today.md.
Mark items [done] when finished so they drop out of the active list.

## Active

### Infrastructure hardening (deployment task — do with Render staging/production)
- What: Add network-level protection at the host: firewall rules, DDoS/WAF protection (e.g. Cloudflare in front), restrict inbound to required ports, lock down Atlas network access to known IPs.
- Type: infrastructure (not a code task — done at deploy time, verified in the host dashboards)
- Reference: none
- Notes: app-level defenses (rate limiting, validation, helmet headers, XSS/CSRF) live in CLAUDE.md standards; THIS item is the network/infra layer that sits outside the app code.

### Infinite scroll across list pages
- What: Replace "load more" buttons with auto-loading infinite scroll (e.g. 30 posts, then 30 more on scroll) with a loading spinner, on all list pages — feed, profiles, all users, all posts.
- Type: phase-d (collides with planned cursor pagination)
- Reference: none
- Progress: MAIN FEED done (commit a2d50c1) — keyset cursor pagination + IntersectionObserver infinite scroll, reusable backend util (cursorPagination.js) + frontend hook (useCursorPagination).
- Progress: SWEEP phase 1 done (branch autopilot/2026-07-03-pagination-sweep, commits 20d7d4c backend + 916ec74 frontend) — added a reusable `<InfiniteScroll>` primitive (spinner + observer with modal scroll-root) and cursor-paginated: profile media grid, followers, following, and the likes modal (refactored off its one-off pagination). New backend endpoints GET /cards/explore, /users/browse, /users/:id/followers, /users/:id/following, /cards/:id/comments (all { items, nextCursor }, block-aware). 34 new API tests; browser-verified at 390/1280.
- Progress: SWEEP phase 2 done (branch autopilot/2026-07-03-list-search-pagination, commits 103791d backend + 994b683 frontend) — ALL-USERS (/allusers) and ALL-POSTS (/allcards) moved to SERVER-SIDE search/sort/filter + infinite scroll. New endpoints GET /users/search (name search, gender, countries, age/name sorts), GET /users/countries, GET /cards/search (search incl. by-creator-name, categories, newest/oldest/most-liked/most-commented sorts, creatorId) — offset cursor, { items, nextCursor }, block-aware. Favorites mode stays client-side; filter-option count badges dropped. 35 new API tests; seeded ~40 users + ~50 cards; browser-verified at 390/1280 (search narrows, filters/sorts drive the query, multi-page scroll). Also fixed a latent UserReusableCard aboutMe crash.
- Progress: SWEEP phase 3 done (branch autopilot/2026-07-04-comments-pagination) — COMMENTS list now paginates via GET /cards/:id/comments (useCursorPagination + InfiniteScroll + spinner, newest-first). Optimistic add/like/reply/delete reconcile into the loaded window WITHOUT pulling the un-loaded backlog: existing items are refreshed/removed from the authoritative card.comments, and only strictly-newer comments (new adds) are prepended (guarded by a newestSeen ceiling + didInit gate). Deep-link (comment-notification) pages until the target comment loads, then scrolls/highlights. Browser-verified at 390/1280: multi-page comment scroll (3 cursor pages), add appears at top (count 28→29), like updates in place. — MERGED to main (commit d19e444).
- Progress: SWEEP phase 4 done (branch autopilot/2026-07-05) — NOTIFICATIONS list now paginates via GET /notifications?cursor=&limit= returning { items, nextCursor, unreadCount } (keyset createdAt+_id, newest-first; removed the hard .limit(50)). Added a `{toUser,createdAt,_id}` index. Panel rewired to useCursorPagination + InfiniteScroll (scroll-root = the panel's own overflow Box), replacing the slice/"More.." button. unreadCount moved to its own state (was client-derived from the full 50-item array): server computes it over ALL rows on the first page; a monotonic token + optimistic clear on mark-read stops a late fetch from resurrecting a stale badge. 4 existing tests updated for the new `{items}` shape (notifications, post-removed-notification, block-hardening) + new notifications-pagination.test.js (9 cases: shape, limit/nextCursor, newest-first, past-50 reachability, unreadCount over all rows, cursor-page omits count, malformed→400, empty). API 290 tests green, API + changed-web files lint clean. Browser-verified at 390/1280: first page 20 → scroll auto-loads to 100–112 items (6 cursor pages, past 50); bell badge 40 → 0 on open; 0px horizontal overflow. — MERGED to main (commit 6c07f14).
- Progress: SWEEP phase 5 — CHAT MESSAGES done — MERGED to main (commit c02502e). GET /messages/:id keyset-paginated `{messages,nextCursor}` reusing cursorPagination (newest page first, reversed to ascending; deletedAt floor + cursor under $and); `{conversationId,createdAt,_id}` index. Reverse infinite scroll: `useChat` prepends older pages; ChatPage + dock anchor scroll on prepend via useLayoutEffect; auto-scroll keys on tail identity. 4 new API tests; browser-verified at 390/1280 on a 35-msg thread (correct anchoring, no jumps). Conversation-LIST pagination split off (see below).
- Progress: SWEEP phase 6 — CONVERSATION LIST done — awaiting review (branch autopilot/2026-07-11). GET /chats now keyset-paginated by `updatedAt` `{conversations,nextCursor,totalUnread}` (extended cursorPagination with a configurable sort field, default createdAt — all existing callers unchanged). `totalUnread` moved SERVER-SIDE (computed over ALL conversations on the first page only) so the nav badge no longer regresses when the client holds just page 1; ChatProvider seeds it from page 1 and keeps it live via socket deltas (increment on receive, subtract on read/delete). Both the full ChatPage list and the dock MessagingBar wired to InfiniteScroll (each with its own scroll-root). New chat-conversation-pagination.test.js (ordering, cursor walk, limit clamp, malformed→400, and the key regression: totalUnread counts ALL conversations not just the page); 3 existing tests updated for the new envelope shape. api 308 green + lint clean; web 161 green; browser-verified at 390/1280 (page 1 = 15 + nextCursor, scroll auto-loads page 2, server-seeded badge, no console errors).
- Progress: SWEEP phase 7 — ADMIN PANELS done — awaiting review (branch autopilot/2026-07-11). Both admin tables (AdminUsersPanel, AdminCardsPanel) moved off the full getAllUsers/getAllCards arrays to SERVER-SIDE offset pagination. New GET /users/admin and GET /cards/admin (admin-guarded, `if(!isAdmin) 403`) return `{items,total,page,limit}` via a MongoDB aggregation with `$facet` (items + count) — server-side search/filter/sort with escaped regex; users get aggregated followersCount + postsCount, cards get creatorName + likesCount/commentsCount (`$size` guarded with `$ifNull` for legacy docs). Numbered-page UI + "X–Y of Z" now driven by server `total`; new `useOffsetPagination` hook; creator filter is now a server-side name SEARCH (scales past a dropdown), country filter uses GET /users/countries; mutations (ban/promote/delete) refetch the current page. New admin-pagination.test.js (22 cases: 401/403 guard, page slicing, no-overlap, search/role/gender/status/category/creator filters, sort order, safe projection). api 330 green + lint clean; web 161 green; browser-verified at 390/1280 (page 2 fires page=2, search narrows total 27→1, no console errors, no mobile overflow).
- Still TODO (need their own order): retire the global getAllCards/getAllUsers providers so nothing loads the full collection (server-authoritative follower/following counts now shipped — commit 0d566b8; admin panels no longer drive off those providers as of phase 7). ASSESSED 2026-07-11 (autopilot run): this is a LARGE migration, NOT a small step — it is the read-side half of master-plan #15/#16 and is coupled to the React Query adoption (deferred so it doesn't collide with the fresh pagination). Concrete blocker list to schedule as its own order:
  - getAllUsers blockers: (1) `useFollowUser.getFollowersCount` scans ALL users for every follower count shown anywhere (10+ render sites) → switch callers to the server `followersCount` field (already on user objects); (2) all 5 profile sub-routes resolve the subject via `users.find(id)` → per-page `getSingleUser(id)`; (3) CardItem + CardDetailsModal liker-avatar strip `users.filter(u=>card.likes.includes(u._id)).slice(0,4)` on every feed card → server embeds top-4 liker objects in the feed/card payload; (4) CardsComments commenter/reply-author resolution → embed commenter user in the comment; (5) Notifications sender → embed sender in the notification; (6) chat participant resolution (MessagingBar/ConversationList/ChatPage) → embed the other user in the conversation payload; (7) AllCardsPage creator picker → async `searchUsers(q)` (exists); (8) admin `useAnalytics` (13 full-array passes) → dedicated server analytics endpoints.
  - getAllCards blockers: (1) `useLikedCards`/`useCommentsCards` counts + isLikeByMe read `registeredCards.find` for every card → refactor hooks to take the card object (feedCards already carries likes/comments); (2) UserProfileMain posts tab → `getExploreCards(cursor,limit,userId)` (exists) paginated; (3) post-count displays (6+ sites) → server-embed `postsCount` on user objects; (4) CardDetailsPage/Modal resolve card by id from registeredCards (skeleton-forever bug if absent) → activate the commented-out `GET /cards/:id`; (5) `addAuthorToFeed` merges a followed user's posts from registeredCards → call the user-posts endpoint; (6) admin analytics totals/engagement → analytics endpoints.
  - Recommendation: do this WITH the React Query migration (#15) as one deliberate order, server-embedding user/card sub-objects endpoint-by-endpoint, not a big-bang. Not force-built in the 2026-07-11 run to avoid destabilizing the three features shipped that day (chat/admin pagination, optimistic like).
- Not read-time block-aware (notifications): blocks are enforced at notification CREATION (block-hardening); the read endpoint was never block-filtered, so pagination preserved that. Read-time filtering is a separable follow-up if wanted.
- Notes: DO NOT build ad-hoc. This is the same work as Phase D cursor pagination — belongs there to avoid building it twice.

### TASK B — Messaging stops after a long session  [BACKLOG ONLY — DO NOT BUILD THIS RUN]
- Type: bug → diagnose-only, handled in a separate session
- Symptom: After a long logged-in session the user can't send DMs; sends silently fail until logout + relogin. Likely token expiry interacting with the socket/auth layer.
- Notes: Queued investigation task. Do not implement now; handled in a separate session.

## Awaiting review

### Retire load-everything providers — slice 1: notification sender embed — awaiting review
- Built on branch autopilot/2026-07-11-2. First slice of the #15/#16/#4 provider-retirement epic (server-embed sub-objects so consumers stop scanning the global users/cards arrays). GET /notifications now embeds `sender { _id, name, lastName, profilePicture }` per item via one `User.find({_id:$in})` (no N+1, chatSvc manual fetch-and-attach pattern); `fromUser==null` system notifications (post-removed) get `sender: null`. `Notifications.jsx` reads `notification.sender` and no longer imports/uses UsersProvider at all. Tests: 2 new API cases (sender embedded + null for system notif); web Notifications.test.jsx updated to carry `sender` and dropped its users-provider mock (proves the component renders with NO global users array). api 332 green + lint clean; web 163 green.

### Retire load-everything providers — slice 2: conversation participant embed — awaiting review
- Built on branch autopilot/2026-07-11-2. GET /chats now embeds `otherUser { _id, name, lastName, profilePicture, job, address }` per conversation via one batched `User.find({_id:$in})` (no N+1). `ConversationList`, `MessagingBar`, and `ChatPage` read `chat.otherUser` instead of scanning the global users array — all three dropped their `UsersProvider`/`users`-prop dependency (ChatPage's `?to=` deep-link now uses the embedded participant when the conversation is loaded, else fetches `getSingleUser(id)` once). Caught + fixed a real regression in browser verification: ChatHeader had an unguarded `otherUser?.address.city` that crashed the whole tree to a blank page when the slim embed lacked `address` — embed now carries job/address and the access is hardened to `?.city`. New API assertion (each conversation carries otherUser); api 333 green + lint clean; web 163 green; browser-verified at 390/1280 (list + dock show partner names/avatars, opening a conversation renders header name + job/city + thread, switching works).

### Retire load-everything providers — slice 3: feed liker-avatar embed — awaiting review
- Built on branch autopilot/2026-07-11-2. `GET /cards/feed` now embeds `likePreview` (first ~4 likers as `{_id,name,lastName,profilePicture}`) per card via a shared `attachLikePreview(cards)` helper in cardsSvc (batched `User.find`, no N+1; unliked cards get `[]`). `CardItem` + `CardDetailsModal` render the avatar strip from `card.likePreview` when present, FALLING BACK to the old `users.filter` for surfaces not yet enriched — so nothing crashes when the global users array is later emptied (avatars just degrade to count-only there; the count is always authoritative). Optimistic like keeps working (likePreview is cosmetic/stale-safe, count unchanged). 4 new API tests (likePreview present/shape/empty/cap-at-4). api 337 green + lint clean; web 163 green; browser-verified at 390/1280 (avatar strip renders from likePreview, like/unlike no crash, no console errors).

### Retire load-everything providers — slice 4: comment/reply author embed — awaiting review
- Built on branch autopilot/2026-07-11-2. Every comment + reply now carries `author` ({_id,name,lastName,profilePicture,job} on comments; no job on replies) via shared cardsSvc helpers (`attachCommentAuthors`/`attachCommentAuthorsToCard`/`attachAuthorsToComments`) — one batched `User.find` per page/card, no N+1. Applied at ALL comment-serializing paths because CardsComments reconciles its list by REPLACING items from `card.comments`: list endpoints (getCards, getFavoriteCards, getFeedCards, getCardsPage, getCardsSearch), single/mutation responses (getPublicCard, likeCard, addComment, addReply, removeComment, likeComment), and the paginated GET /cards/:id/comments — enrichment ordered AFTER stripBlockedComments. `CardsComments.jsx` reads `comment.author ?? users.find(...)` (and reply.author) — prefers the embed, falls back for safety. 7 new API tests. api 344 green + lint clean; web 163 green; browser-verified at 390/1280 (existing + freshly-added comments AND replies show author name/avatar, GET response carries author on comments + replies, no console errors).

### Optimistic like (post + comment) mutations — awaiting review
- Built on branch autopilot/2026-07-11. Master-plan Phase D #15 "follow/like/comment become optimistic mutations (the real fix — no refetch, no scroll-jump)". FOLLOW was already in-place (AuthProvider setUser + UsersProvider.syncUser + feed splice — no refetch), so no change needed. Made the two TOGGLE mutations optimistic with rollback in CardsProvider: `handleToggleLike` and `handleToggleCommentLike` now flip my id in the card's likes (or the target comment/reply's likes) in both state arrays IMMEDIATELY, fire the request, reconcile with the authoritative server card on success, and revert on error (pure-toggle-is-its-own-inverse). CardsComments' existing reconcile effect syncs the visible paginated list from card.comments, so the heart flips at once. Add-comment/reply/delete-comment left on their proven await-then-reconcile path (fast, no scroll-jump) to avoid regressing the delicate newestSeen-ceiling/didInit reconcile logic — instant-append is a possible follow-up. New OptimisticLike.test.jsx (flips before the server responds; reverts on failure). web 163 green; browser-verified at 390/1280 (Like flips instantly, single PATCH with NO GET refetch, no scroll jump, toggles back). React Query deliberately NOT adopted here: optimistic UI needs the READS migrated too (Context providers own them), which is the larger #15/#16 bundle and would collide with the just-shipped pagination — deferred.

## Done

(finished items move here, newest on top)

### Favorites → server API (cross-device) — DONE
- Merged to main as 04ac248. `favorites:[ObjectId]` on User + `/users/me/favorites` POST/DELETE/GET (fresh hydrated cards, block/status-filtered, save order). `useFavoriteCards` keeps its return shape so none of the 8 consumers changed — fetches on login, optimistic add/remove with revert-on-error. Fresh DB reads also fix the old stale-snapshot problem. 9 new API tests; api 303 green + lint clean; browser-verified at 390/1280 — a save survives a localStorage wipe + reload (server-persistence proof), shows in the Favorites filter, unsave removes it.
- FOLLOW-UP (small, separate order): the save button still renders on a BANNED post (only admins see banned posts in-feed); clicking it 404s and the optimistic add reverts silently. Hide/disable the save button when `card.status !== 'active'` in CardItem. Not a favorites bug — works correctly for all active posts.

### Chat message pagination + reverse infinite scroll — DONE
- Merged to main as c02502e (+ Conversation indexes fefc876). GET /messages/:id keyset `{messages,nextCursor}` (reuses cursorPagination, reversed to ascending; per-side deletedAt floor + cursor under $and); `{conversationId,createdAt,_id}` index. Frontend reverse infinite scroll: `useChat` prepends older pages; ChatPage + dock anchor scroll on prepend via useLayoutEffect (no viewport jump); auto-scroll keys on tail identity. 4 new API tests; browser-verified at 390/1280 (35-msg thread, correct anchoring). Conversation-LIST pagination DEFERRED to its own order (needs server-side totalUnread so the nav unread badge isn't regressed; ChatProvider is load-bearing) — its enabling indexes `{fromUser,updatedAt}`+`{toUser,updatedAt}` already shipped in fefc876.

### Vercel preview URLs blocked by backend CORS — DONE
- Merged to main as 512dadb. Shared `isOriginAllowed()` in `config/allowedOrigins.js` (static allowlist + optional project-scoped `PREVIEW_ORIGIN_REGEX`) used by BOTH the HTTP cors middleware and socket.io in function form so they can't drift. Scoped regex over blanket `*.vercel.app` deliberately (credentials enabled); unset ⇒ no preview origins allowed; malformed regex ignored. Documented in `.env.example`. 6 new unit tests; live-verified ACAO emitted for allowed origins, omitted for disallowed. Set `PREVIEW_ORIGIN_REGEX` per environment at deploy time to enable preview hosts.

### Server-authoritative follower/following counts — DONE
- Merged to main as 0d566b8. Counts computed in `projectUser` server-side instead of derived client-side from a fully-loaded users array. `followingCount` = deduped `$size` of the doc's `following`; `followersCount` via `countDocuments` on `GET /users/:id` and ONE aggregation over the result set on `GET /users` (no N+1). Profile UI reads the server fields with a graceful `??` fallback. Closes master-plan Phase D #14 counts-source piece (removes one blocker to retiring the global users provider). 3 new API tests; browser-verified at 390/1280 (7 followers / 4 following render; cross-checked against the raw follow graph).

### Mobile-native feed posts (IG/FB style) + dark-mode border fix + mobile bug batch — DONE
- Merged to main (branch autopilot/2026-07-05, fast-forward) across e51cc61 (mobile posts), 7457896 (dark-mode border fix), 16aed92 (mobile bug batch).
- Feed posts responsive in `CardItem.jsx`: on mobile (xs) the post root breaks out of the Container/Grid gutter (`width:100vw` + `mx:calc(50% - 50vw)`) → edge-to-edge media, no side border, square corners, soft `divider` hairline + small gap between posts. Desktop (md+) keeps the bordered, rounded, floating card. One component, MUI sx breakpoints only.
- Dark-mode fix: post-card and notification-panel borders were rendering SOLID WHITE in dark mode — a responsive `border:{...}` shorthand + separate `borderColor:'divider'` let the border fall back to `currentColor`. Fixed by baking `theme.palette.divider` into the shorthand; borders now match the create-post block / left profile card. Notification dropdown gained a subtle shadow.
- Mobile bug batch: (1) `AllCardsPage.jsx` posts column `<Grid size={{md:8}}>` was missing `xs` → 1-col auto-placement broke the full-bleed math → `size={{xs:12, md:8}}` (0px overflow). (2) `CardPopupModal.jsx` close button un-tappable on mobile (react-zoom-pan-pinch transform stacking + `touchAction:none` swallowed the tap) → added `zIndex:1102`. (3) `FeedPage.jsx` right "People You May Know" column now `display={{xs:'none',md:'block'}}` (mobile uses the inline MobileSuggestions carousel).
- Browser-verified in light AND dark at 390/1280, with a real mobile touch context (hasTouch/isMobile + touchscreen.tap): edge-to-edge media, soft borders, tap-closes-modal, PYMK hidden on mobile / shown on desktop, 0px horizontal overflow. Web 161 / API 281 tests green.
- Known separate quirk (NOT fixed — pre-existing, own future order): a post modal opened via a `?card=` deep-link URL on `/allcards` doesn't close on the X (a sync effect re-applies the param); normal tap-to-open closes fine.

### Main-feed cursor pagination + infinite scroll — DONE
- Committed on branch autopilot/2026-07-03 as a2d50c1 (Phase D). Keyset cursor (createdAt+_id, opaque base64url, limit-N+1 hasMore) replaces the all-at-once max-30 load; GET /cards/feed returns { cards, nextCursor }. Two Card indexes (verified IXSCAN, no COLLSCAN). Frontend: reusable useCursorPagination hook + IntersectionObserver sentinel, skeleton loader, and initial/loading-more/empty/end("You're all caught up")/error-retry states. Cold-start "Suggested for you" feed switched from in-app likes re-rank to recency (required for a stable cursor). Browser-verified at 390px & 1280px (1 request on load → scroll auto-loads page 2 → caught-up, no further requests). API 200 / web 161 tests green; API lint clean. Reusable pattern; profiles/all-users/all-posts lists still to adopt it (see Active "Infinite scroll across list pages").

### FEATURE 1 — New-user onboarding + non-empty first feed — DONE
- Merged to main across T1/T2/T13 (suggested-users endpoint + onboarding fields + popular-feed fallback 9e51af4; first-run wizard with interests / suggested-follows / finish-profile steps + "Suggested for you" feed label 2ef38fe; finish-profile step gated to Google-login users + built-in selects 1129e11; wizard button-style polish 2aa0b65). Cold-start feed shows recent public posts labeled "Suggested for you"; wizard shown once via onboardingComplete; covered by apps/api/tests/onboarding.test.js; browser-verified at 390px and 1280px.

### FEATURE 5 — Fullscreen, zoomable chat images — DONE
- Merged to main as 4eb907f (T12). Chat image messages open in a fullscreen viewer with gradual scroll/pinch/double-tap zoom + pan (reused ZoomableImage), from both full chat and the dock; closes via X/backdrop/Esc.

### FEATURE 4 — Block user from the chat 3-dot menu — DONE
- Merged to main as 4ba5fbe (T11). "Block user" added to the chat overflow ⋯ menu in both ChatHeader and DockedChatWindow (new ⋯ for the dock); confirm → block → conversation closes and leaves the list/dock.

### FEATURE 3 — Likes-count modal + report-a-post (+ admin) — DONE
- Merged to main across T6–T10 (likes endpoint 9ee316f, likes modal fca64f9, report backend 1dc213d, report UI 4994277, admin reports 49bf7be). Clickable "N likes" → paginated likers modal with follow state; report-a-post with reason picker + dedupe; admin Reports column + reporter list + admin notification.

### FEATURE 2 — Smarter notifications — DONE
- Merged to main across T3–T5 (delete-bug + comment copy 1ace22b, deep-link + comment anchor 0640575, notification settings ef90715). Trash deletes without navigating; "commented on your post" copy; like/comment notifs deep-link to the post; reply/comment-like notifs scroll to + highlight the comment; per-type notification settings gate creation server-side.

### TASK A — External share OG/Twitter preview route — DONE
- Merged to main as f2db9fc (public GET /s/card/:id serves post-specific OG + Twitter tags with image c_fill / video so_0 poster, then redirects humans to the SPA card). Real WhatsApp/LinkedIn crawler rendering remains a staging acceptance gate (localhost is crawler-unreachable).

### TASK D — Share dialog recent-contacts default list — DONE
- Merged to main as 52e510e (new GET /users/recent-contacts; share dialog shows up to 10 recent DM contacts on open, typing searches all users, clearing restores; block-aware, owner-only).

### TASK C — Video poster in shared card — DONE
- Merged to main as 1fd99cd (server-built sharedCard.posterUrl = Cloudinary so_0 frame for Cloudinary videos; non-Cloudinary videos use a seeked muted <video> first-frame instead of a black box).

### Blocked accounts management screen — DONE
- Merged to main as 7564f73 (Blocked settings tab + BlockedUsersSection backed by GET /users/blocked; resolves the post-reload unblock dead-end).

### Chat dock (LinkedIn-style) — DONE
- Merged to main as 9f54ba8, reworked in d1a5542 (persistent bottom-right Messaging bar listing all conversations with presence dots + one larger chat window that swaps on open; hidden on /chat and on mobile).

### LinkedIn-style suggested/mutual friends modals — DONE
- Merged to main as 7d558a0 (reusable PeopleModal with scroll-pagination from the feed sidebar + profile mutual/suggested panels; just-followed person lingers ~5s in suggested mode).

### Mobile friends-suggestions between posts — DONE
- Merged to main as 1ad3aa8 (mobile "People you may know" carousel after the 3rd feed post + See all modal; hidden on desktop).

### Block user — DONE
- Merged to main as 53b7138, hardened in 7564f73 (server-enforced block both directions across lists/profile/feed/messaging/follow + posts & comments via getHiddenUserIds/stripBlockedComments; locked-profile placeholder reachable only from the Blocked list).
- Hardening pass (branch autopilot/2026-06-29, awaiting review): closed 3 residual gaps — (A) getChats() now drops conversations with a blocked counterpart so the stale DM thread leaves the chat list + dock; (B) comment-like / comment-reply notifications are suppressed across a block (third-party comment-author case); (C) like/comment WRITE endpoints now 403 a blocked actor (read already 404'd). Tests: apps/api/tests/block-hardening.test.js. UX polish (confirm dialog, ⋯ menu on user cards, undo snackbar) and report-user deliberately deferred.

### Share a post — DONE
- Merged to main as c549524, rebuilt to real-app standard in ac13700 (server-search recipient picker, auto-close on send, clickable rich sharedCard card in chat that opens the post; external Web Share + copy-link kept).

### Comment-on-comment / subcomments — DONE
- Merged to main as 5e18438 (single-level Instagram/YouTube-style replies + 'comment-reply' notification to the comment author).

### "Add post" on own profile — DONE
- Merged to main as 80a156c, spacing fix 7410593 (owner-gated CreateCard composer on the profile tab, with a top gap matching the rest of the page).

### Image zoom in post modal — DONE
- Merged to main as fa4ef71, gradual-zoom fix fb14a8d (pinch/scroll/double-click zoom + drag-pan; wheel step lowered so zoom climbs gradually to ~4x and clamps, zoom-out clamps at fit).

### Auto-play video on scroll into view — DONE
- Merged to main as c3034da (feed videos auto-play muted when ≥60% visible, pause on scroll away, via the existing VideoCoordinator).

### Notify author when their post is removed/banned — DONE
- Merged to main as a80708e ('post-removed' notification to the author on ban, gavel icon, moderator identity hidden).

### Sticky left sidebar on scroll (desktop) — DONE
- Merged to main as 13d9e9c (feed left column position:sticky on desktop; mobile unchanged).

### Like a comment — DONE
- Merged to main as 53a7cb8 (heart like toggle + count per comment; 'comment-like' notification to the comment author).

### Online/offline status dot on users — DONE
- Merged to main as 7173d5e (green/grey presence dot on user + chat avatars via a minimal Socket.io presence layer).

### Multi-step register form — DONE
- Merged to main via PR #1 (3-step MUI Stepper: Account / About you / Location; dropped phone/job/about-me; phone+lastName optional in the shared user-validation API; form password rule aligned to the API's strong rule; button-gap below step fields fixed).

### Video/media in public profile + rename to "media" — DONE
- Merged to main as 798e439 (videos render in the profile media grid; "Photos" → "Media").

### Mobile video posts won't open as modal — DONE
- Merged to main as a0ae628 (transparent tap overlay over feed videos opens the modal on mobile).

### Posts uniform height in feed — DONE
- Shipped: feed media keeps natural aspect ratio with a max-height 600px cap; over-tall media cropped from the top. In CardItem.
- Merged to main as b63773e.
