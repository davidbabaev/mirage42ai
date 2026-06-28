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
- Notes: DO NOT build ad-hoc. This is the same work as Phase D cursor pagination — belongs there to avoid building it twice.

### Vercel preview URLs blocked by backend CORS
- What: Vercel preview deployments get a unique, per-deploy hostname that isn't in the API's CORS allowlist, so the preview frontend can't call the backend (requests fail CORS).
- Type: infrastructure / config
- Reference: none
- Notes: needs the API CORS origin check to also allow Vercel preview hostnames (e.g. match the `*.vercel.app` preview pattern / per-branch URLs) instead of only the fixed production origin. Keep on Active.

### Blocked accounts management screen (follow-up to Block user)
- What: A "Blocked accounts" settings list where you can see everyone you've blocked and unblock them. Needed because blocked users are server-excluded from the user lists the profile page reads from, so after a reload there's no discoverable way to reach a blocked user's profile to unblock. Currently unblock works only in-session right after blocking.
- Type: feature (UX completion)
- Reference: none

## Awaiting review

### Chat-popup docked windows system
- What: Facebook-style docked chat-popup windows (multiple open chats anchored to the bottom of the screen).
- Type: feature
- Shipped: ChatDockProvider (global, above the router; open/close/minimize, cap 3) + ChatDock (desktop-only bottom-right row) + DockedChatWindow/useConversationThread reusing the existing useChat + chat components. Profile "Message" opens a dock on desktop (no navigation), navigates to /chat on mobile. Browser-verified: desktop open/send/receive/minimize/close without leaving the page; mobile full-screen fallback.
- Built on branch autopilot/2026-06-27, commit 9f54ba8 — awaiting review/merge.

### LinkedIn-style suggested/mutual friends modals
- What: "Load more" friends/suggestions opens a modal; separate mutual vs suggested; scroll-pagination; users clickable to profile; a followed user lingers ~5s before leaving (debounce).
- Type: feature
- Shipped: reusable PeopleModal (grid cards, scroll-pagination PAGE=8 + Load more, dismiss, click-through) opened from the feed sidebar "See all" (suggested) and the profile Mutual friends / Make New Friends panels (mutual + suggested). Suggested mode lingers a just-followed person ~5s; mutual mode never removes. Browser-verified: suggested at 390px + 1280px, mutual at desktop.
- Built on branch autopilot/2026-06-27, commit 7d558a0 — awaiting review/merge.

### Mobile friends-suggestions between posts + show-more modals
- What: On mobile, interleave friends-suggestion cards between feed posts, with "show more" opening suggestion modals.
- Type: feature
- Shipped: mobile-only "People you may know" horizontal carousel inserted after the 3rd feed post (compact cards: avatar/name/job/Follow/dismiss), with a "See all" modal listing all suggestions; users clickable to profile. Desktop keeps its existing sidebar (strip hidden at md+). Browser-verified at 390px (strip + modal) and 1280px (hidden).
- Built on branch autopilot/2026-06-27, commit 1ad3aa8 — awaiting review/merge.

### Block user
- What: Block a user so their content is hidden and they can't interact with you.
- Type: feature
- Shipped: PATCH /users/:id/block toggle; blocked users hidden from lists/suggestions (getUsers) and profile (getUser 404), mutual follows removed (clears feed both ways), messaging rejected (chat getOrCreateConversation), follow rejected — all enforced server-side; `blocked` exposed only to the owner. Block/Unblock button on the profile (desktop + mobile). Browser-verified end-to-end at 390px and 1280px.
- Follow-up: discoverable post-reload unblock needs a Blocked-accounts settings screen (see Active).
- Built on branch autopilot/2026-06-27, commit 53b7138 — awaiting review/merge.

### Share a post
- What: Share an existing post (repost / share to feed or external share).
- Type: feature
- Shipped: ShareDialog from the post action row — in-app share sends the post to a chosen user via the chat socket (caption + deep link); external share uses Web Share API with a copy-link fallback. Deep link /allcards?card=<id> opens the post modal. Browser-verified at 390px and 1280px (recipient receives it in chat; clipboard + deep link work).
- Built on branch autopilot/2026-06-27, commit c549524 — awaiting review/merge.

### Comment-on-comment / subcomments
- What: Reply to a comment to create nested/threaded subcomments under it.
- Type: feature
- Shipped: single-level replies (Instagram/YouTube-style). API adds a `replies` subdocument + PATCH .../replies that notifies the comment author ('comment-reply'); web adds a per-comment Reply toggle, nested reply list, and the notification text. Browser-verified end-to-end at 390px and 1280px (sarah comments -> david replies nested -> sarah notified).
- Built on branch autopilot/2026-06-27, commit 5e18438 — awaiting review/merge.

### "Add post" on own profile
- What: Add-post entry point on the user's own public profile page so they can post directly from there.
- Type: feature
- Shipped: reuses the feed's CreateCardTrigger -> CreateCardModal composer on the PROFILE tab, owner-gated (never on others' profiles), shown at all widths. Browser-verified at 390px and 1280px (real post created + appears; absent on another user's profile).
- Built on branch autopilot/2026-06-27, commit 80a156c — awaiting review/merge.

### Image zoom in post modal
- What: Click/tap a post image inside the post modal to zoom it (full-size lightbox view).
- Type: feature
- Shipped: pinch (mobile) + scroll/double-click (desktop) zoom with drag-to-pan in the post-details modal, via a new ZoomableImage component (react-zoom-pan-pinch); feed images unchanged. Browser-verified at 390px and 1280px.
- Built on branch autopilot/2026-06-27, commit fa4ef71 — awaiting review/merge.
- FIX (gradual zoom): wheel `step` was 0.15; with the library's `smooth:true`, zoomStep = step × |deltaY| (~120/notch) → one notch slammed to maxScale (the "single fixed level"). Lowered to 0.0025 so each notch is ~0.3x; double-click changed from `toggle` to incremental `zoomIn`. Now wheel zooms gradually 1→4 and clamps, zoom-out clamps at 1, pan works. Re-verified at 390px and 1280px. Built on branch autopilot/2026-06-28, commit 31a504e.

## Done

(finished items move here, newest on top)

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
