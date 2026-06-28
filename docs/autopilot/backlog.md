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

### TASK A — External share previews (Open Graph / rich link cards)
- Type: feature (buildable now; external rendering only verifiable on staging)
- Problem: Shared card links show as bare URLs on WhatsApp/LinkedIn/etc — no preview image, title, or text.
- Root cause: The web app is a client-rendered SPA. Social crawlers don't run JS; they read Open Graph meta tags from the raw HTML, and index.html only has generic tags. localhost is also unreachable by crawlers, so external previews only work on a public domain — verify HTML output locally, treat WhatsApp/LinkedIn rendering as a staging gate.
- Decisions:
  - Add a public server-rendered route on the API: GET /s/card/:cardId returning minimal HTML with:
    og:title (author name + short snippet), og:description (post text, newlines stripped, ~200 chars),
    og:image (absolute https; image posts: Cloudinary image c_fill ~1200x630; video posts: sharedCard.posterUrl from Task C; fallback: default Mirage42 banner),
    og:url (canonical SPA deep link), og:type article, og:site_name Mirage42,
    twitter:card summary_large_image + twitter:title/description/image.
  - Human redirect with NO user-agent sniffing: include BOTH <meta http-equiv="refresh" content="0;url=..."> AND <script>location.replace('...')</script> pointing to /allcards?card=:cardId.
  - Build the OG snapshot from the existing server-built sharedCard source — never trust client preview data.
  - The Share dialog copy-link / outbound link now hands out /s/card/:cardId (in-app card clicks keep the existing deep link).
  - Make /s/card/:cardId block-aware: if the author blocked the viewer or the card is gone, serve a neutral "This post isn't available" OG card (reuse getHiddenUserIds). Optional if it bloats scope.
- Check:
  - Local: curl GET /s/card/:id returns 200 HTML with post-specific OG + Twitter tags and an absolute Cloudinary og:image (test both an image post and a video post); a browser hitting the URL lands on the SPA card.
  - Note in backlog that full external (WhatsApp/LinkedIn) verification is a STAGING acceptance item.

### TASK B — Messaging stops after a long session  [BACKLOG ONLY — DO NOT BUILD THIS RUN]
- Type: bug → diagnose-only, handled in a separate session
- Symptom: After a long logged-in session the user can't send DMs; sends silently fail until logout + relogin. Likely token expiry interacting with the socket/auth layer.
- Notes: Queued investigation task. Do not implement now; handled in a separate session.

### TASK D — Share dialog: recent-contacts default list (Instagram-style)
- Type: feature (extends the picker)
- Current: The picker is empty until you type. Target: open it and immediately see likely recipients.
- Decisions:
  - On open, fetch up to 10 most-recent contacts and show them as the default list (avatar + name), most-recent first.
  - "Recent contacts" = other participants of the user's most recent DM conversations, deduplicated, capped at 10. If fewer than 10 conversations exist, show what exists (may optionally pad with recent follows, but conversations take priority and ordering).
  - New endpoint: GET /users/recent-contacts?limit=10 — owner-only, registered BEFORE /users/:id (same route-ordering gotcha as /users/blocked). Returns id, displayName, avatar, lastInteractedAt.
  - Placeholder text becomes "Search other people".
  - Typing switches to the existing GET /users?q=&limit= search; clearing the box restores the recent list.
  - Selecting a person enables SEND (unchanged send flow / sharedCard snapshot).
  - Block-aware: exclude users the owner blocked or who blocked the owner from both the recent list and search (reuse getHiddenUserIds).
- Check:
  - Browser (390/1280): open Share → up to 10 recent DM contacts with avatars; placeholder reads "Search other people"; typing searches all users; clearing restores the recent list; blocked users never appear; selecting + SEND delivers the shared card.
  - API: GET /users/recent-contacts returns ≤10, recency-ordered, excludes blocked, owner-only.

## Awaiting review

### TASK C — Video posts: real poster preview in the shared card
- Type: bug/feature (extends sharedCard)
- Shipped: server-built sharedCard now derives `posterUrl` for video posts — a Cloudinary `so_0` .jpg frame for Cloudinary-hosted videos (`cloudinaryVideoPoster` in chatSvc, reused as Task A's og:image). SharedPostCard renders posterUrl as the thumbnail; for non-Cloudinary videos (e.g. seed Sintel/Big Buck Bunny, where no Cloudinary frame exists) it falls back to a muted `<video>` seeked ~15% in (capped 4s) to show a real content frame instead of a black box — a strict improvement over the old dark placeholder. Image-post sharing unchanged. New tests in share-post.test.js (poster derivation + snapshot); full api suite green (108).
- Browser-verified at 390px and 1280px: Cloudinary video → poster image; Sintel → real content frame (not black); image card unchanged.
- DECISION: the named "Sintel Trailer" seed video is an EXTERNAL url (blender.org), not Cloudinary, so a pure-Cloudinary poster can't satisfy its check — hence the universal first-frame `<video>` fallback. Real app uploads (Cloudinary) get the lighter `<img>` poster + a valid OG image.
- Built on branch autopilot/2026-06-28-2, commit 1fd99cd.

### Blocked accounts management screen (was Active — follow-up to Block user)
- What: A "Blocked accounts" settings list where you can see everyone you've blocked and unblock them.
- Shipped as part of the Block-user hardening below (new "Blocked" tab in DashboardLayout + BlockedUsersSection backed by `GET /users/blocked`). Resolves the post-reload unblock dead-end.
- Built on branch autopilot/2026-06-28, commit 7564f73.

### Chat-popup docked windows system
- What: Facebook-style docked chat-popup windows (multiple open chats anchored to the bottom of the screen).
- Type: feature
- Shipped: ChatDockProvider (global, above the router; open/close/minimize, cap 3) + ChatDock (desktop-only bottom-right row) + DockedChatWindow/useConversationThread reusing the existing useChat + chat components. Profile "Message" opens a dock on desktop (no navigation), navigates to /chat on mobile. Browser-verified: desktop open/send/receive/minimize/close without leaving the page; mobile full-screen fallback.
- Built on branch autopilot/2026-06-27, commit 9f54ba8 — awaiting review/merge.
- FIX (LinkedIn-style): replaced the multi-window dock with a persistent bottom-right "Messaging" bar (new MessagingBar) listing ALL conversations with presence dots (OnlineBadge) + unread + last-message preview, reusing useChatList/usePresence; clicking a row opens ONE larger window (384×560) to the LEFT of the bar, swapping on each open (provider now holds a single openUser instead of a docks array). Dock hidden on /chat (useLocation) and on mobile; profile "Message" still opens it via the openDock alias. Browser-verified at 1280px (bar on / and /allcards, open + swap, absent on /chat) and 390px (no dock). Built on branch autopilot/2026-06-28, commit d1a5542.

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
- FIX (real-app standard): (1) new "Blocked" settings tab + BlockedUsersSection backed by new `GET /users/blocked`, each row Unblockable; (2) a blocked user's profile now shows a LOCKED placeholder (lock + mock avatar + banner + Unblock, no posts/details), reachable only from that list; (3) app-wide hiding extended SERVER-SIDE to posts + comments/replies — getCards/getPublicCard/getFeedCards now take the requester and drop blocked authors' cards (both directions) and strip their comments (new `getHiddenUserIds`/`stripBlockedComments`); index on `blocked`; (4) fixed the infinite-skeleton dead-end for unavailable profiles. Extended block-user.test.js (12 tests: blocked-list endpoint, card hiding, comment stripping, 404, unblock restore); full api suite green (105). Browser-verified end-to-end at 390px and 1280px (block → gone from search → Blocked list → locked profile → unblock restores). Built on branch autopilot/2026-06-28, commit 7564f73.

### Share a post
- What: Share an existing post (repost / share to feed or external share).
- Type: feature
- Shipped: ShareDialog from the post action row — in-app share sends the post to a chosen user via the chat socket (caption + deep link); external share uses Web Share API with a copy-link fallback. Deep link /allcards?card=<id> opens the post modal. Browser-verified at 390px and 1280px (recipient receives it in chat; clipboard + deep link work).
- Built on branch autopilot/2026-06-27, commit c549524 — awaiting review/merge.
- FIX (real-app standard): was a raw non-clickable URL + full user list. Now (1) recipient picker is a server-side debounced SEARCH (new `GET /users?q=&limit=`, prefix regex, capped) — never loads all users; (2) Send AUTO-CLOSES the dialog; (3) the chat shows a CLICKABLE rich card (image + title + author, opens the post) via a new server-built `sharedCard` snapshot on the Message (client sends only cardId — preview built server-side, untrusted input rejected) rendered by new SharedPostCard in MessageList; (4) external Web Share + copy kept. New api test share-post.test.js (search + snapshot); full api suite green (100). Browser-verified end-to-end at 390px and 1280px (search → select → send → auto-close → rich card in chat → click opens post). Built on branch autopilot/2026-06-28, commit ac13700.

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
- FIX (spacing): the create-post Box sat flush under the profile tabs (it had `mb:2` but no top margin). Added `mt:2` to match the right-column section spacing. Re-verified at 390px and 1280px. Built on branch autopilot/2026-06-28, commit 7410593.

### Image zoom in post modal
- What: Click/tap a post image inside the post modal to zoom it (full-size lightbox view).
- Type: feature
- Shipped: pinch (mobile) + scroll/double-click (desktop) zoom with drag-to-pan in the post-details modal, via a new ZoomableImage component (react-zoom-pan-pinch); feed images unchanged. Browser-verified at 390px and 1280px.
- Built on branch autopilot/2026-06-27, commit fa4ef71 — awaiting review/merge.
- FIX (gradual zoom): wheel `step` was 0.15; with the library's `smooth:true`, zoomStep = step × |deltaY| (~120/notch) → one notch slammed to maxScale (the "single fixed level"). Lowered to 0.0025 so each notch is ~0.3x; double-click changed from `toggle` to incremental `zoomIn`. Now wheel zooms gradually 1→4 and clamps, zoom-out clamps at 1, pan works. Re-verified at 390px and 1280px. Built on branch autopilot/2026-06-28, commit fb14a8d.

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
