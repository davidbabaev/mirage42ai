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

### T9 — Report-a-post UI
- What: Add a ⋯ overflow menu on the post (introduce a reusable one if absent) with "Report post"; opens a reason picker dialog (radio group of the allowlist), submit shows pending → success toast → auto-close. If already reported, show an "already reported" state (disabled/secondary).
- Decisions: auto-close the dialog on success (real-app standard). Reasons from the backend allowlist. Don't allow reporting your own post.
- Done when: a user reports a post via the overflow → reason → success + auto-close; cannot report the same post twice (UI reflects it); verified in browser at 390px and 1280px.
- Type: visual

### T10 — Admin: report column + reporter list
- What: In `AdminCardsPanel.jsx`, add a "Reports" column showing each post's report count (muted when 0); clicking a non-zero count opens a modal listing who reported and why (from `GET /cards/:id/reports`). Surface `post-reported` admin notifications in the admin's notification view.
- Decisions: clicking the count opens a modal (loading/empty/error states); reporter rows show name + reason + time.
- Done when: admin table shows report counts; clicking a count lists reporters + reasons; new reports appear as admin notifications; verified in browser at 390px and 1280px.
- Type: visual

### T11 — Block user from chat 3-dot menu
- What: Add a "Block user" item to the chat ⋯ menu in `ChatHeader.jsx` (alongside Profile + Delete chat) and add a ⋯ menu with Profile / Block / Delete to `DockedChatWindow.jsx` (currently has none). Reuse `useBlockUser().toggleBlock(otherUserId)`. Confirm before blocking (reuse `ConfirmationDialog`); on success show a toast and close/leave the conversation (it disappears from the list/dock per the block-hardening change).
- Decisions: confirm-before-block (real-app standard). Cannot block self. Dock menu is desktop-only (dock is hidden on mobile already).
- Done when: from an open conversation (full chat AND dock) the ⋯ menu shows Block; choosing it confirms, blocks, closes the conversation, and the thread leaves the list/dock; verified in browser at 390px (full chat) and 1280px (full chat + dock).
- Type: visual

### T12 — Fullscreen zoomable chat images
- What: Tapping an image message in `MessageList.jsx` (and the dock's message list) opens it fullscreen in a MUI Dialog wrapping the existing `ZoomableImage` (react-zoom-pan-pinch, already installed). Gradual scroll/pinch/double-tap zoom + pan; dark backdrop; close via X / backdrop / Esc / swipe-down. Loading spinner while the full image loads.
- Decisions: reuse `ZoomableImage` + `MediaDisplay`'s existing `zoomable` branch; don't add a new lightbox library. Zoom is gradual with limits (not a binary toggle).
- Done when: clicking a chat image opens a fullscreen viewer that zooms gradually in/out with pan (scroll+double-click desktop, pinch+double-tap mobile) and closes via X/backdrop/Esc; works from full chat and dock; verified in browser at 390px and 1280px.
- Type: visual
