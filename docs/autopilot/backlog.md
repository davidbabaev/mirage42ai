# Mirage42 — Backlog

Everything we might work on. Add freely. I pull from here into today.md.
Mark items [done] when finished so they drop out of the active list.

## Active

### Infrastructure hardening (deployment task — do with Render staging/production)
- What: Add network-level protection at the host: firewall rules, DDoS/WAF protection (e.g. Cloudflare in front), restrict inbound to required ports, lock down Atlas network access to known IPs.
- Type: infrastructure (not a code task — done at deploy time, verified in the host dashboards)
- Reference: none
- Notes: app-level defenses (rate limiting, validation, helmet headers, XSS/CSRF) live in CLAUDE.md standards; THIS item is the network/infra layer that sits outside the app code.


### Admin analytics → server-side aggregation endpoints
- What: The admin Overview panel currently fetches ALL users + ALL cards on mount (AdminAnalyticsProvider, added 2026-07-13) and computes ~13 analytics passes client-side. That was the deliberate interim step that let us retire the global load-everything providers for every OTHER user — but it does not scale: at 100k+ users an admin opening Overview would pull the entire database into the browser.
- Do: replace with dedicated server aggregation endpoints (totals, engagement, gender/age + country distributions, registrations by month, retention, top-10 active users, most-popular categories, top/last-5 cards, last-5 joined). MongoDB `$facet` aggregations, admin-guarded, mirroring the GET /users/admin + GET /cards/admin pattern from pagination sweep phase 7.
- Type: phase-d follow-up. Not urgent while the dataset is small; REQUIRED before the admin panel runs against a large production dataset.

### TASK B — Messaging stops after a long session  [BACKLOG ONLY — DO NOT BUILD THIS RUN]
- Type: bug → diagnose-only, handled in a separate session
- Symptom: After a long logged-in session the user can't send DMs; sends silently fail until logout + relogin. Likely token expiry interacting with the socket/auth layer.
- Notes: Queued investigation task. Do not implement now; handled in a separate session.

## Awaiting review

### Folder/naming sweep (master-plan #20) — awaiting review
- Built on branch autopilot/2026-07-13-restructure. The "one restructure, done LAST once the architecture has settled" — now due, because the provider-retirement epic is merged and the file layout has stopped moving. Seven commits, one concern each, suites green after every one.
- **Typos that were actually BUGS** (db30f8c): `color='text.secondaty'` in FOUR places (UserProfileLayout, DashboardLayout, FeedPage, UserReusableCard) — MUI silently DROPS an unknown palette key, so that text was never actually muted; it rendered at full contrast. Fixing the spelling fixes the styling. Also `'...showless'` shipped to users with no space, in five places; a "Posts per catrgories" heading; and two admin messages ("succefully", "becam").
- **The space in the folder name** (54a2cfb): `components/reusable components/` → `components/shared/` (a folder with a SPACE, nested inside components/ — components of components). Fixed the misspelled `MostPupularCardReuse` → `MostPopularCardReuse` (file + exported symbol) inside it. 4 importers. NO tracked path in the repo has a space any more.
- **Case-only renames** (ec38d23): `cards/validation/Joi/` → `joi/` (its sibling users/validation/joi/ was already lowercase) and `AdminOverViewPanel` → `AdminOverviewPanel` ("Overview" is one word). Both are case-ONLY, and the Windows/WSL filesystem is case-insensitive — a direct `git mv` silently no-ops and desyncs the index. Done via an intermediate temp name and VERIFIED: git recorded both as real renames (R).
- **Model naming** (d2d03af): `Notifications.js` → `Notification.js` — the only plural model file (Card/User/Message/Conversation/Report are all singular). 7 importers.
- **Pages that lied about what they are** (78a79c3): `CardsRegisterPage` → `CreateCardPage` (it renders the card composer; "register" was the old internal word for creating a post); `RegisteredPage` → `SignUpPage` (it IS the sign-up form — the old name reads like a success screen). Deleted `HomePage.jsx`: dead, nothing imported it, an old wireframe skeleton with an "iamges" typo.
- **Misspelled internal symbols** (003a837): Registaration→Registration, therty→thirty, moreThen→moreThan, Avater→Avatar, editprofilePicture→editProfilePicture — renamed at EVERY reference (a partial rename is worse than none). Plus comment typos in the same files.
- **Browser-verified** (task 7): a rename sweep is exactly the change that passes every unit test and still ships a blank screen — one missed import path, or a case-only rename git never recorded. Loaded all six touched surfaces × 390/1280 in a real Chromium against a throwaway in-memory Mongo (NOT Atlas): sign-up page, create-post page, feed, profile, own dashboard, and the admin Overview panel (whose imports ALL moved). 12/12 render with ZERO console errors.
- OUT OF SCOPE, deliberately: `components/chatDock/` (looks odd but FOLLOWS the convention — multi-word folders are camelCase), and `pages/landing/` + `pages/docs/pages/` (organizational preference, not errors — churn without value).
- api 375 green; web 186 green; lint unchanged (36 pre-existing errors, none added).

## Done

(finished items move here, newest on top)

### Infinite scroll across list pages (Phase D pagination sweep) — DONE
- Merged to main across d19e444, 6c07f14, c02502e and finally bb899e8. EVERY list in the app is now server-paginated with auto-loading infinite scroll — main feed, profile media grid + posts tab, followers, following, likes modal, comments, notifications, chat messages, the conversation list, all-users, all-posts, and MyCardsSection. Reusable primitives: backend `cursorPagination.js` (keyset), frontend `useCursorPagination` + `<InfiniteScroll>` + `useOffsetPagination` (admin). All the old `.slice(0, count)` "Load More" pagers are gone.
- The epic's real endgame — retiring the load-everything providers so no list is ever backed by a fully-downloaded collection — shipped with it (see the entry above).

### Retire the load-everything providers (master-plan #15/#16/#4) — DONE
- Merged to main as bb899e8 (branches autopilot/2026-07-11, -11-2, -07-13; 47 commits, clean fast-forward). **The app no longer downloads every user and every post in the database on login.** `getAllUsers` + `getAllCards` are deleted from UsersProvider/CardsProvider; on login it loads ONE page of the feed and nothing else. Browser-verified across 14 surfaces × 390/1280, as a normal user and as an admin: zero `GET /users`, zero `GET /cards`, zero console errors. api 375 green; web 186 green.
- Server-embeds that made it possible: notification `sender` (0186d08), conversation `otherUser` (125b89e), feed `likePreview` (cfe58a9), comment/reply `author` (4f2a293), user `postsCount` + `GET /cards/:id` (04ac248→slice 5), card `creator` incl. followersCount (a92cef7, 4064f69). All batched — no N+1.
- Consumer migrations: mutation overlay upserts (86cb72e), profile posts tab + MyCardsSection paginate off the server (326ec1c), own-user counts at the auth entry points (701cc82), addAuthorToFeed fetches instead of splicing (3516b02), profile subject resolved once from the server (483f878), /allcards creator filter searches the server (e09192a), PYMK + new `GET /users/:id/mutual` endpoint (527c2fa), user overlay keeps follower counts live (41e9064), admin analytics fetched on demand (2f0920c), and THE DELETION (8545f90).
- Guard test: `NoGlobalLoadOnLogin.test.jsx` — mounting the providers logged-in must fire neither global load. If anyone reintroduces one, it fails.
- Bugs found and fixed on the way: follow/block/edit wiped the logged-in user's own counts (AuthProvider replaced the user wholesale); "Report" was offered on your own post when the author object didn't resolve; favorites silently DROPPED a saved post whose author wasn't loaded; every feed card read "0 followers" after the deletion (creator embed carried no count); and the creator picker itself reintroduced a full-table `GET /users` via `searchUsers('')` — `searchUsers()` now refuses an empty term outright.
- DEFERRED (see Active): the admin Overview panel still pulls both full collections, but only when an admin opens it — no longer at app mount for every visitor. Proper server-side aggregation endpoints are filed as a follow-up.
- React Query (#15) deliberately NOT adopted: the overlay approach achieves #4 without it and is more reversible.

### Optimistic like (post + comment) mutations — DONE
- Merged to main as bb899e8 (built on autopilot/2026-07-11, commit 4ecc0dc). Master-plan Phase D #15. `handleToggleLike` + `handleToggleCommentLike` flip instantly, reconcile with the authoritative server card, and revert on error (a pure toggle is its own inverse). Follow was already in-place. OptimisticLike.test.jsx covers flip-before-response and revert-on-failure; browser-verified (single PATCH, no GET refetch, no scroll jump).

### Conversation-list pagination + server-side totalUnread — DONE
- Merged to main as bb899e8 (built on autopilot/2026-07-11, commit d61f561). `GET /chats` keyset-paginated by `updatedAt`; `totalUnread` computed SERVER-side over ALL conversations so the nav badge doesn't regress when the client holds only page 1.

### Admin panels off the global arrays (server-side offset pagination) — DONE
- Merged to main as bb899e8 (built on autopilot/2026-07-11, commit 661efc6). `GET /users/admin` + `GET /cards/admin` (admin-guarded, `$facet` aggregation → `{items,total,page,limit}`); numbered-page UI driven by server `total`; creator filter is a server-side SEARCH. 22 new API tests.

### Deep-linked post modal wouldn't close (`?card=`) — DONE
- Merged to main as bb899e8 (commit 980cffd). The sync effect re-applied the still-present query param and reopened the modal — so a post opened from a SHARED LINK could never be closed. The param now applies only when it changes, and closing clears `card`/`comment` from the URL with `replace:true`.

### Save button rendered on a banned post — DONE
- Merged to main as bb899e8 (commit b88ca90). It could only ever 404 and silently revert; hidden now (not disabled). Closes the follow-up left by the favorites order.

### Dead CardDetailsPage deleted — DONE
- Merged to main as bb899e8 (commit eb5d0ab). Imported in App.jsx with no registered `<Route>` — unreachable. Deliberately NOT given a route: `/allcards?card=<id>` already IS the app's post deep-link (chat shared cards, external share links, notifications all use it), and CardDetailsPage was a raw unstyled duplicate of the modal.

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
