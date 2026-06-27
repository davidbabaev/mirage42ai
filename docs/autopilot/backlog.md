# Mirage42 — Backlog

Everything we might work on. Add freely. I pull from here into today.md.
Mark items [done] when finished so they drop out of the active list.

## Active

### Infrastructure hardening (deployment task — do with Render staging/production)
- What: Add network-level protection at the host: firewall rules, DDoS/WAF protection (e.g. Cloudflare in front), restrict inbound to required ports, lock down Atlas network access to known IPs.
- Type: infrastructure (not a code task — done at deploy time, verified in the host dashboards)
- Reference: none
- Notes: app-level defenses (rate limiting, validation, helmet headers, XSS/CSRF) live in CLAUDE.md standards; THIS item is the network/infra layer that sits outside the app code.

### LinkedIn-style suggested/mutual friends modals
- What: "Load more" friends/suggestions opens a popup modal; separate modals for mutual vs suggested; scrollable with scroll-pagination (show more on scroll); users clickable through to their profile; matches LinkedIn-style design; a followed user stays visible ~5 seconds before leaving the list (debounce).
- Type: feature (multi-part — modal + pagination + navigation + debounce + design)
- Reference: docs/autopilot/refs/linkdin-referance-suggested-list.png, docs/autopilot/refs/suggestion-users-publicuserpage.png, docs/autopilot/refs/firends-suggest-feed.png, docs/autopilot/refs/linkdin2-friendssuggest.png
- Notes: NOT a quick bug. Needs its own planning session before it runs.

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

## Awaiting review

### Online/offline status dot on users
- What: Small green(online)/grey(offline) presence dot on the bottom-right of user avatars, on the users list and the chat conversation list. Minimal Socket.io presence layer added (presenceService + user-online/user-offline + snapshot); web PresenceProvider + reusable OnlineBadge.
- Built on branch autopilot/2026-06-27, commit 7173d5e — awaiting review/merge.

### Like a comment
- What: Heart like toggle + like count on each comment, mirroring the post-like flow; notifies the comment author via a new 'comment-like' notification type ("liked your comment"). Backend likeComment + PATCH /cards/:id/comments/:commentId/like; web useLikedComments hook + heart control in CardsComments.
- Built on branch autopilot/2026-06-27, commit 53a7cb8 — awaiting review/merge.

### Sticky left sidebar on scroll (desktop)
- What: Feed left column (profile + favourites) is position:sticky on desktop (top 24px), staying in view as the feed scrolls; mobile unchanged (column hidden on xs). One-line sx change on FeedPage's left Grid item.
- Built on branch autopilot/2026-06-27, commit 13d9e9c — awaiting review/merge.

### Notify author when their post is removed/banned
- What: Banning a post (admin) creates a 'post-removed' notification to the author with a fixed moderation message and gavel icon; moderator identity is not exposed. Triggers in banCard on active->banned only.
- Built on branch autopilot/2026-06-27, commit a80708e — awaiting review/merge.

## Done

(finished items move here, newest on top)

### Multi-step register form — DONE
- Merged to main via PR #1 (3-step MUI Stepper: Account / About you / Location; dropped phone/job/about-me; phone+lastName optional in the shared user-validation API; form password rule aligned to the API's strong rule; button-gap below step fields fixed).

### Video/media in public profile + rename to "media" — DONE
- Merged to main as 798e439 (videos render in the profile media grid; "Photos" → "Media").

### Mobile video posts won't open as modal — DONE
- Merged to main as a0ae628 (transparent tap overlay over feed videos opens the modal on mobile).

### Posts uniform height in feed — DONE
- Shipped: feed media keeps natural aspect ratio with a max-height 600px cap; over-tall media cropped from the top. In CardItem.
- Merged to main as b63773e.
