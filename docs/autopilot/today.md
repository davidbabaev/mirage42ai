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

### Comment-on-comment (subcomments / replies)
- What: Let users reply to a comment, creating nested replies under it.
- Decisions: Agent decides depth/indentation/UX using real-app conventions (Instagram/YouTube single-level replies acceptable if full nesting is complex). Reuse existing comment + notification systems. Notify the parent comment's author. Follow CLAUDE.md.
- Done when: a user can reply to a comment, the reply shows nested, parent author notified; verified end-to-end at both widths.
- Type: feature

### Share a post
- What: Let users share a post — to other users inside the app, and to external platforms.
- Decisions: Agent decides full implementation using real-app conventions: in-app share (send to another user via messaging/notification system) and external share (Web Share API where available, copy-link fallback, sensible external targets). Follow CLAUDE.md.
- Done when: a user can share a post to another user in-app AND share/copy-link externally; verified at both widths.
- Type: feature

### Block user
- What: Let a user block another user, applying privacy effects across the app.
- Decisions: Agent decides full behavior using real-app conventions (blocked users can't see/interact: hidden from feeds, profiles, suggestions, messaging; existing follows removed). Enforce server-side, not just UI hiding. Reuse existing patterns. Follow CLAUDE.md security standards.
- Done when: blocking removes mutual visibility/interaction across feed, profile, suggestions, and messaging, enforced server-side; verified end-to-end.
- Type: feature

### Mobile friends-suggestions between posts + show-more modals
- What: On mobile, insert a friends-suggestions block between feed posts, with a "show more" that opens a modal.
- Decisions: Agent decides frequency/layout/modal UX using real-app conventions (Instagram/LinkedIn inject suggestion cards in mobile feeds). Reuse existing suggestion data + modal pattern. Mobile-focused. Follow CLAUDE.md.
- Done when: mobile feed shows a suggestions block between posts with a working show-more modal; verified at 390px; desktop unaffected.
- Type: feature

### LinkedIn-style suggested/mutual friends modals
- What: "Load more" on suggestions/friends opens a modal; separate modals for mutual vs suggested; scrollable with scroll-pagination; users clickable to their profile; a followed user stays ~5s before leaving the list (debounce).
- Decisions: Agent decides design/pagination using real-app conventions and the reference images in docs/autopilot/refs/ (linkdin-referance-suggested-list.png, suggestion-users-publicuserpage.png, firends-suggest-feed.png, linkdin2-friendssuggest.png). Reuse existing suggestion data + modal pattern. Follow CLAUDE.md.
- Done when: separate mutual/suggested modals open, paginate on scroll, users click through to profiles, a followed user persists ~5s before leaving; verified at both widths.
- Type: feature

### Chat-popup system (docked chat windows)
- What: Build a LinkedIn-style docked chat system — chat windows that pop up and dock at the bottom of the screen, so users can message without leaving the page they're on.
- Decisions: Agent decides the full design using real-app conventions (LinkedIn/Facebook docked chat: open conversations as bottom-docked windows, minimize/close, multiple windows, opens from clicking a user/message). Reuse the existing messaging backend, Socket.io, and conversation data — this is primarily a new UI layer over existing chat, not a new messaging system. On mobile, fall back to the existing full-screen chat. Follow CLAUDE.md. This is the largest task — take it carefully.
- Done when: clicking to message a user opens a docked chat window that works (send/receive via existing system), can minimize/close, without leaving the current page; mobile uses existing full-screen chat; verified at both widths.
- Type: feature
