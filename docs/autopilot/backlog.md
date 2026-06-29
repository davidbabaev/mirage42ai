# Mirage42 — Backlog

Everything we might work on. Add freely. I pull from here into today.md.
Mark items [done] when finished so they drop out of the active list.

## Active

### FEATURE 1 — New-user onboarding + non-empty first feed
- Progress: T1 backend done (commit 9e51af4); T2 wizard UI done — OnboardingWizard component, apiService additions, FeedPage "Suggested for you" label, 12 new tests, browser-verified at 390px and 1280px.
- What: A new user (register form OR Google OAuth) currently lands on an empty feed (follows nobody) and gets no guidance. Build the real-app first-run experience: (1) a non-empty feed for users with zero follows — show popular/trending public posts labeled "Suggested for you" so the first screen is never blank; (2) a post-registration onboarding wizard shown once, as ordered steps with Skip / Back / Next / Done: **Step 1 — Pick interests** (select from the existing post categories; multi-select chips), **Step 2 — Suggested people to follow** (real users, searchable, follow inline), **Step 3 — Finish your profile** (only if `isProfileIncomplete`, prefilled, inline edit). Skipping any step is allowed and lands on the (now non-empty) feed; completing sets `onboardingComplete`.
- Reference: Instagram / X / LinkedIn first-run — interests picker, "suggested to follow" with one-tap follow, cold-start feed seeded with popular content. Wizard pattern like LinkedIn signup steps.
- States: each step has loading (skeleton user/category rows), empty ("No suggestions yet — search to find people"), error (retry), and a disabled/looping state on Next while saving. Feed cold-start has its own labeled section + empty fallback if even popular posts are zero.
- Entry points: shown automatically on first authenticated render when `onboardingComplete` is false, for BOTH the form-register redirect and the Google `?token=` landing. Reachable again later from settings? (defer — onboarding is one-time.)
- Data/API: add `User.onboardingComplete: Boolean` (default false) and `User.interests: [String]`; `PATCH /users/me/onboarding` to set interests + mark complete; `GET /users/suggested?limit=&cursor=` returning real users to follow (exclude self + already-following + blocked-either-way, prefer friends-of-friends then popular-by-followers), follow-state included; `getFeedCards` gains a popular-posts fallback (most-liked/most-recent active public posts, block-aware, paginated) when the viewer's visible following set is empty — labeled distinctly so the client can show "Suggested for you".
- Permissions/security: server-side — `PATCH /users/me/onboarding` only mutates the caller; suggested + popular queries are block-aware both directions; never expose private fields. Agents-as-users: an agent account hitting the same endpoints is fine (one code path).
- Responsive: 390px — full-screen single-column wizard, sticky bottom action bar (Skip left, Back/Next right), category chips wrap, suggested-user rows full width. 1280px — centered card (max ~560px) over a dimmed backdrop, same steps, action bar inside the card. Cold-start feed identical layout to normal feed, just a "Suggested for you" header.
- A11y: stepper is keyboard navigable, focus moves to step heading on change, chips are toggle buttons with aria-pressed, Next/Skip ≥44px, reduced-motion respected.
- Done-when: a brand-new account (both register paths) sees the wizard once; can skip straight through to a feed that shows popular posts (not blank); can pick interests + follow ≥1 suggested user + finish profile and land on a feed including those follows; re-login does NOT show the wizard again; correct at 390px and 1280px.

### FEATURE 2 — Smarter notifications
- Progress: T3 (delete bug + comment copy) done, commit 1ace22b.
- Progress: T4 deep-link + comment anchor done, commit 0640575.
- Progress: T5 notification settings done, commit ef90715. FEATURE 2 complete.
- What: Four fixes + one addition on the existing notifications dropdown (`Notifications.jsx`). (Bug) The delete (trash) button navigates to the sender's profile because the click bubbles to the row — stop propagation so delete only deletes. (Copy) `comment` type renders "commentd your post" — fix to "commented on your post". (Deep-link) Clicking a like/comment notification about your post opens THAT post (not the sender profile). (Deep-link) Clicking a comment-reply / comment-like notification opens the post AND scrolls to + briefly highlights the specific comment. (Addition) Notification settings: per-type toggles like a real app.
- Note: `comment-like` ("liked your comment") and `comment-reply` ("replied to your comment") notifications ALREADY exist on backend + frontend text — do NOT rebuild them; only add their deep-linking + the settings gate.
- Reference: Instagram/X notifications — tap a like/comment notif → jump to the post; tap a reply notif → jump to the comment; per-type notification settings.
- States: row hover/active, delete optimistic with rollback on failure, empty ("No notifications yet"), loading skeleton rows, error. Highlighted comment fades after ~2s.
- Entry points: the bell dropdown in NavBar; deep-link opens the existing `CardPopupModal` via `/allcards?card=<whichCard>`; comment anchor via an added `?comment=<commentId>` param the modal reads to scroll/highlight.
- Data/API: notifications already carry `whichCard`. For the comment anchor, persist the relevant `commentId` on comment-like/comment-reply notifications (add field) so the client can scroll to it. Settings: add `User.notificationPrefs` (per-type booleans, all default true); gate notification CREATION server-side on the recipient's prefs; `PATCH /users/me/notification-prefs`.
- Permissions/security: a user only ever sees/deletes their own notifications (already enforced); deep-link respects block/visibility (a post hidden by block 404s as usual); settings mutate only the caller.
- Responsive: 390px — dropdown becomes a full-width sheet; rows have comfortable tap targets, delete is a swipe-or-tap target ≥44px not overlapping the row tap. 1280px — anchored dropdown. Settings page works at both.
- A11y: each row is a button with a label; delete is a separate labelled button; highlighted comment uses a non-color cue too.
- Done-when: clicking the trash icon deletes WITHOUT navigating; a `comment` notification reads "commented on your post"; clicking a like/comment-on-your-post notif opens that post; clicking a comment-reply/comment-like notif opens the post scrolled to the highlighted comment; toggling a type off in settings stops new notifications of that type; correct at 390px and 1280px.

### FEATURE 3 — Likes-count modal + report-a-post (+ admin)
- What: (a) Make the likes count/avatars on a post clickable to open a modal listing everyone who liked it — each row: avatar, name, job, follower count, and a Follow button (or "Following" text when already followed), exactly like the `refs/likes-count-modal.png` and the comment user block. (b) Let any user report a post (reason picker); reports go to the admin as notifications and increment a per-post report count; the admin posts table gains a "Reports" column, and clicking the count shows WHO reported (and why).
- Reference: Instagram likes list (tap "N likes" → user list with follow buttons); Instagram/X report flow (overflow → Report → reason → confirm + auto-close); admin moderation queue.
- States: likes modal — loading skeleton rows, empty (0 likes → count not clickable / "No likes yet"), error, paginated scroll for large like counts (assume 100k+; never load all at once), optimistic follow from within the modal. Report — overflow menu item, reason dialog, submitting state, success toast + auto-close, "already reported" state (can't double-report). Admin — report-count column, 0 shows muted, reporter-list modal with loading/empty/error.
- Entry points: likes — the "N likes" text + avatar cluster on `CardItem.jsx` and `CardDetailsModal.jsx` become a button. Report — a ⋯ overflow menu on the post (introduce if absent) with "Report post". Admin — `AdminCardsPanel.jsx` new column + clickable count.
- Data/API: reuse `PeopleModal` for the likes list. Add `GET /cards/:id/likes?cursor=&limit=` → liker users (avatar, name, job, followersCount, isFollowing), block-aware, paginated (do NOT ship the client-side-only list for scale). Report: new `Report` model `{ cardId, reporterId, reason, createdAt }` (unique per reporter+card), `POST /cards/:id/report` (validated reason enum), `GET /cards/:id/reports` (admin-only, reporter identities), and a denormalized `reportCount` on the card or an aggregate; on report, create an admin-targeted Notification (new actionType `post-reported`).
- Permissions/security: report endpoint authed, one report per user per post (dedupe server-side), reason validated against an allowlist (no injection); `GET /cards/:id/reports` and the reporter identities are admin-only (authorization check, not just auth); likes endpoint block-aware.
- Responsive: 390px — likes modal full-width sheet, rows stack, follow button reachable; report reason dialog full-width. 1280px — centered dialogs. Admin table column visible/scrollable on small screens.
- A11y: likes count is a labelled button ("View N likes"); follow buttons labelled; report reasons are a radio group; modals trap focus.
- Done-when: clicking "N likes" opens a modal of likers with working follow/Following state; modal paginates and doesn't choke on many likers; a user can report a post via the overflow, picks a reason, sees success + auto-close, and cannot report the same post twice; the admin sees a Reports column with the count and can click it to see who reported and why; an admin notification appears on a new report; correct at 390px and 1280px.
- Progress: T6 likes endpoint done, commit 9ee316f.
- Progress: T7 likes modal done, commit fca64f9.
- Progress: T8 report backend done, commit 1dc213d.
- Progress: T9 report UI done, commit 4994277.
- Progress: T10 admin reports done, commit 49bf7be. FEATURE 3 complete.

### FEATURE 4 — Block user from the chat 3-dot menu
- What: Add "Block user" to the chat conversation overflow (⋯) menu alongside the existing Profile and Delete-chat items, in BOTH the full chat (`ChatHeader.jsx`) and the docked chat window (`DockedChatWindow.jsx`, which currently has no ⋯ menu — add one for parity). Uses the existing block path; after blocking, the conversation closes/leaves the list (consistent with the block-hardening change that drops blocked conversations from `getChats`).
- Reference: WhatsApp/Instagram/Messenger — block lives in the chat header overflow; blocking removes the thread and shows a confirmation.
- States: confirmation dialog before block (reuse `ConfirmationDialog`), the action shows a brief pending state, success toast, then the chat view closes/empties. Unblock path not required here (managed in settings).
- Entry points: ⋯ menu in `ChatHeader` (full chat) and a new ⋯ in `DockedChatWindow`.
- Data/API: reuse `useBlockUser().toggleBlock(otherUserId)` → `PATCH /users/:id/block` (already block-aware everywhere). No new endpoint.
- Permissions/security: block mutates only the caller's block list (already enforced server-side); cannot block self.
- Responsive: 390px — full chat header ⋯ opens a touch-friendly menu; dock isn't shown on mobile (existing behavior) so the dock ⋯ is desktop-only. 1280px — both menus work. Confirmation dialog centered/legible at both.
- A11y: ⋯ button labelled "More options"; menu items keyboard reachable; destructive Block styled as such with a confirm.
- Done-when: from an open conversation (full chat AND dock), the ⋯ menu shows Block; choosing it confirms, blocks the user, closes the conversation, and the thread disappears from the list/dock; correct at 390px (full chat) and 1280px (full chat + dock).

- Progress: T11 block-from-chat done, commit 4ba5fbe. FEATURE 4 complete.

### FEATURE 5 — Fullscreen, zoomable chat images
- What: Tapping/clicking an image message in chat opens it fullscreen with gradual zoom (scroll/pinch/double-tap) and pan, like WhatsApp — on mobile and desktop. Reuse the existing `ZoomableImage` (`react-zoom-pan-pinch`, already installed and used in the post-detail modal) inside a fullscreen MUI Dialog. Works in the full chat (`MessageList.jsx`) and the docked chat window.
- Reference: WhatsApp/Telegram image viewer — dark backdrop, pinch/scroll zoom with limits, pan when zoomed, double-tap to zoom to point, swipe-down or tap-X / backdrop to dismiss.
- States: tap target on the image bubble (cursor zoom-in on desktop), loading spinner while the full image loads, error fallback if it fails, smooth gradual zoom (not a binary toggle), reset on close.
- Entry points: any image message bubble in `MessageList.jsx` and the dock's message list.
- Data/API: none (client-only; image URL already present on the message).
- Permissions/security: only renders images already visible in a conversation the user is part of (unchanged).
- Responsive: 390px — fullscreen dialog edge-to-edge, pinch + double-tap zoom, swipe-down to dismiss, close button reachable, respects safe areas. 1280px — fullscreen/large dialog, scroll-to-zoom + double-click, click backdrop or X to close. Reduced-motion respected.
- A11y: image has alt text; dialog traps focus; Esc closes; zoom controls reachable; close button ≥44px.
- Done-when: clicking a chat image opens a fullscreen viewer; the image zooms GRADUALLY in/out (with limits) and pans when zoomed, via scroll+double-click on desktop and pinch+double-tap on mobile; closes via X/backdrop/Esc/swipe; works from full chat and dock; correct at 390px and 1280px.

### Infrastructure hardening (deployment task — do with Render staging/production)
- What: Add network-level protection at the host: firewall rules, DDoS/WAF protection (e.g. Cloudflare in front), restrict inbound to required ports, lock down Atlas network access to known IPs.
- Type: infrastructure (not a code task — done at deploy time, verified in the host dashboards)
- Reference: none
- Notes: app-level defenses (rate limiting, validation, helmet headers, XSS/CSRF) live in CLAUDE.md standards; THIS item is the network/infra layer that sits outside the app code.

### Infinite scroll across list pages
- What: Replace "load more" buttons with auto-loading infinite scroll (e.g. 30 posts, then 30 more on scroll) with a loading spinner, on all list pages — feed, profiles, all users, all posts.
- Type: phase-d (collides with planned cursor pagination)
- Reference: none
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
