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
