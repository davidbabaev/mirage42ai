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
- Progress: MAIN FEED done (commit a2d50c1) — keyset cursor pagination + IntersectionObserver infinite scroll, with a reusable backend util (cursorPagination.js) and frontend hook (useCursorPagination) built to be adopted by the remaining pages. Still TODO: profiles, all-users, all-posts lists (adopt the same cursor pattern; each needs its endpoint to return { items, nextCursor } and its list to use useCursorPagination).
- Notes: DO NOT build ad-hoc. This is the same work as Phase D cursor pagination — belongs there to avoid building it twice.

### Vercel preview URLs blocked by backend CORS
- What: Vercel preview deployments get a unique, per-deploy hostname that isn't in the API's CORS allowlist, so the preview frontend can't call the backend (requests fail CORS).
- Type: infrastructure / config
- Reference: none
- Notes: needs the API CORS origin check to also allow Vercel preview hostnames (e.g. match the `*.vercel.app` preview pattern / per-branch URLs) instead of only the fixed production origin. Keep on Active.

### TASK B — Messaging stops after a long session  [BACKLOG ONLY — DO NOT BUILD THIS RUN]
- Type: bug → diagnose-only, handled in a separate session
- Symptom: After a long logged-in session the user can't send DMs; sends silently fail until logout + relogin. Likely token expiry interacting with the socket/auth layer.
- Notes: Queued investigation task. Do not implement now; handled in a separate session.

## Awaiting review

(none)

## Done

(finished items move here, newest on top)

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
