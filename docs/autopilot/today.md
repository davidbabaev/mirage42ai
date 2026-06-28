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

## Tasks

### TASK D — Share dialog: recent-contacts default list (Instagram-style)
- What: The picker is empty until you type. Target: open it and immediately see likely recipients.
- Decisions:
  - On open, fetch up to 10 most-recent contacts and show them as the default list (avatar + name), most-recent first.
  - "Recent contacts" = other participants of the user's most recent DM conversations, deduplicated, capped at 10. If fewer than 10 conversations exist, show what exists (may optionally pad with recent follows, but conversations take priority and ordering).
  - New endpoint: GET /users/recent-contacts?limit=10 — owner-only, registered BEFORE /users/:id (same route-ordering gotcha as /users/blocked). Returns id, displayName, avatar, lastInteractedAt.
  - Placeholder text becomes "Search other people".
  - Typing switches to the existing GET /users?q=&limit= search; clearing the box restores the recent list.
  - Selecting a person enables SEND (unchanged send flow / sharedCard snapshot).
  - Block-aware: exclude users the owner blocked or who blocked the owner from both the recent list and search (reuse getHiddenUserIds).
- Done when (Check):
  - Browser (390/1280): open Share → up to 10 recent DM contacts with avatars; placeholder reads "Search other people"; typing searches all users; clearing restores the recent list; blocked users never appear; selecting + SEND delivers the shared card.
  - API: GET /users/recent-contacts returns ≤10, recency-ordered, excludes blocked, owner-only.
- Type: feature

### TASK A — External share previews (Open Graph / rich link cards)
- What: Shared card links show as bare URLs on WhatsApp/LinkedIn/etc — no preview image, title, or text. The web app is a client-rendered SPA; social crawlers don't run JS, they read Open Graph meta tags from raw HTML, and index.html only has generic tags. localhost is also unreachable by crawlers, so external previews only work on a public domain — verify HTML output locally, treat WhatsApp/LinkedIn rendering as a staging gate.
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
- Done when (Check):
  - Local: curl GET /s/card/:id returns 200 HTML with post-specific OG + Twitter tags and an absolute Cloudinary og:image (test both an image post and a video post); a browser hitting the URL lands on the SPA card.
  - Note in backlog that full external (WhatsApp/LinkedIn) verification is a STAGING acceptance item.
- Type: feature
