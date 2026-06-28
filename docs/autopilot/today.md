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

### FIX: Share post — clickable rich preview, search, auto-close, IG-style chat card
- What: The share-post feature currently sends a raw, non-clickable URL and lists all users. Rebuild it to real-app standard.
- Decisions:
  1. SCALE: replace the full user list with a SEARCH box (type a name → search returns matching users). Never render all users. Assume 100k+ users.
  2. AUTO-CLOSE: after pressing Send, the share modal closes automatically.
  3. RICH CARD IN CHAT: a post shared into a Mirage chat must appear as a CLICKABLE preview card — post image/thumbnail + title/snippet + author — exactly like the Instagram-DM shared-post example (a tappable card, not a URL). Clicking it opens that post.
  4. EXTERNAL share keeps Web Share API + copy-link fallback.
- Done when: sharing a post in-app sends a clickable rich preview card into the chat (image + text, opens the post on click); the recipient picker is a search box not a full list; the modal auto-closes on send; verified at both widths.
- Type: feature

### FIX: Block user — settings list, locked profile, app-wide hiding
- What: Rebuild block behavior to match real social apps.
- Decisions:
  1. SETTINGS: add a "Blocked users" section in the logged-in user's settings showing everyone they've blocked, each with an UNBLOCK action (like Instagram/Facebook).
  2. LOCKED PROFILE: a blocked user's profile is NOT fully deleted from view — it shows a LOCKED page only: a lock icon, a placeholder/mock avatar, and a short banner saying the user is blocked. Nothing else (no posts, no details).
  3. REACHABLE ONLY VIA THE LIST: that locked profile page is reachable ONLY by clicking the user in the Blocked-users settings list.
  4. HIDDEN EVERYWHERE ELSE: the blocked user must NOT appear anywhere else in the app — not in feed, search, suggestions, followers/following, messaging, comments. Enforce server-side.
- Done when: blocking hides the user app-wide (server-enforced); they appear only in the settings Blocked list; opening them from that list shows the locked placeholder profile; unblock restores them; verified end-to-end.
- Type: feature

### FIX: Chat dock — global sticky bar of all chats, one big popup, presence, not on Messages page
- What: Rebuild the docked chat to match LinkedIn's docked messaging (see refs / the LinkedIn screenshots).
- Decisions:
  1. GLOBAL STICKY BAR: a persistent "Messaging" dock pinned to the bottom-right across the app, listing the user's conversations, each with an online/offline presence dot next to the user.
  2. ONE OPEN CHAT AT A TIME: clicking a conversation opens ONE chat window, positioned to the LEFT of the sticky bar. Opening another replaces it (only one open).
  3. BIGGER WINDOW: the open chat window is larger than the current small one — comparable to the LinkedIn example, comfortably readable.
  4. NOT ON MESSAGES PAGE: the entire dock (bar + popup) must NOT render on the /messages (full chat) page — only on other pages.
  5. MOBILE: falls back to the existing full-screen chat, no dock.
- Done when: a sticky messaging bar with presence dots shows on all pages except /messages; clicking a user opens one larger chat window to its left; opening another swaps it; nothing docked appears on the Messages page; mobile uses existing full-screen chat; verified at both widths.
- Type: feature
