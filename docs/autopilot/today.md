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

### Online/offline status dot on users
- What: Show a small status dot indicating whether a user is currently online or offline, on user list items and in the chat/messages list.
- Decisions: green dot = online, grey = offline. Small dot on the bottom-right of the avatar. "Online" = has an active socket connection (reuse the existing Socket.io connection state; do not build new presence infrastructure if a simple connected/disconnected signal already exists). If determining real presence requires backend work beyond what exists, implement the minimal server signal needed.
- Done when: online users show a green dot and offline users show grey (or no dot), on the users list and chat list, confirmed at 390px and 1280px.
- Type: feature

### Like a comment
- What: Let users like a comment (not just posts). Show a heart/like control on each comment with a like count, and notify the comment's author when their comment is liked.
- Decisions: mirror the existing POST like implementation as closely as possible (same toggle behavior, same notification pattern) — do not invent a new pattern. Heart icon + count next to each comment. Liking is a toggle (like/unlike). Notification to the comment author reuses the existing notifications system.
- Done when: a user can like/unlike a comment, the count updates, and the author receives a notification — verified end-to-end. Confirmed at 390px and 1280px.
- Type: feature

### Sticky left sidebar on scroll (desktop)
- What: On desktop, the left sidebar (profile card / nav) should stay fixed in view as the feed scrolls, instead of scrolling away.
- Decisions: desktop only (position sticky). On mobile, leave current behavior unchanged. Sidebar sticks below the top navbar with a small gap.
- Done when: on desktop (1280px) the left sidebar stays visible while the feed scrolls; mobile (390px) behavior is unchanged.
- Type: visual

### Notify author when their post is removed/banned
- What: When a post is banned/removed (by admin/moderation), send a notification to the post's author telling them their post was removed.
- Decisions: reuse the existing notifications system. Message like "Your post was removed for violating community guidelines." Trigger at the existing ban/remove action in the API. Do not expose moderator identity.
- Done when: banning a post creates a notification to that post's author, verified end-to-end.
- Type: logic

### Auto-play video on scroll into view, pause on scroll away
- What: In the feed, a post's video should auto-play (muted) when it scrolls into view and pause when it scrolls out of view — like Instagram/TikTok feeds.
- Decisions: muted autoplay (browsers require muted for autoplay). Use IntersectionObserver; play when ~60% visible, pause otherwise. Only one video plays at a time ideally, but if that's complex, per-video in/out is acceptable. Respect existing video controls.
- Done when: scrolling a video into view auto-plays it muted, scrolling away pauses it, confirmed at 390px and 1280px.
- Type: visual
