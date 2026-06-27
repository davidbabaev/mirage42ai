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
