# Autopilot — Today's Work

This file is the day's task list for the autopilot.
Each task = what to do + how to know it's done + a type tag.
Clear and rewrite it each day. Git keeps the history.

## Tasks

<!-- TASK FORMAT:
### Task title
- What: clear description of the change.
- Decisions: pre-answer any choices you care about (fields, behavior, look, edge cases). Anything not listed here, the agent decides itself and logs in its report.
- Done when: how to verify it's actually working.
- Type: logic | visual | feature
-->

### Chat-popup system (docked chat windows)
- What: Build a LinkedIn-style docked chat system — chat windows that pop up and dock at the bottom of the screen, so users can message without leaving the page they're on.
- Decisions: Agent decides the full design using real-app conventions (LinkedIn/Facebook docked chat: open conversations as bottom-docked windows, minimize/close, multiple windows, opens from clicking a user/message). Reuse the existing messaging backend, Socket.io, and conversation data — this is primarily a new UI layer over existing chat, not a new messaging system. On mobile, fall back to the existing full-screen chat. Follow CLAUDE.md. This is the largest task — take it carefully.
- Done when: clicking to message a user opens a docked chat window that works (send/receive via existing system), can minimize/close, without leaving the current page; mobile uses existing full-screen chat; verified at both widths.
- Type: feature
