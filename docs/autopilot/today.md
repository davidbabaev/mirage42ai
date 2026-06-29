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


### T12 — Fullscreen zoomable chat images
- What: Tapping an image message in `MessageList.jsx` (and the dock's message list) opens it fullscreen in a MUI Dialog wrapping the existing `ZoomableImage` (react-zoom-pan-pinch, already installed). Gradual scroll/pinch/double-tap zoom + pan; dark backdrop; close via X / backdrop / Esc / swipe-down. Loading spinner while the full image loads.
- Decisions: reuse `ZoomableImage` + `MediaDisplay`'s existing `zoomable` branch; don't add a new lightbox library. Zoom is gradual with limits (not a binary toggle).
- Done when: clicking a chat image opens a fullscreen viewer that zooms gradually in/out with pan (scroll+double-click desktop, pinch+double-tap mobile) and closes via X/backdrop/Esc; works from full chat and dock; verified in browser at 390px and 1280px.
- Type: visual
