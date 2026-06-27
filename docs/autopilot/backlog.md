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

### Image zoom in post modal
- What: Click/tap a post image inside the post modal to zoom it (full-size lightbox view).
- Type: feature

### "Add post" on own profile
- What: Add-post entry point on the user's own public profile page so they can post directly from there.
- Type: feature

### Comment-on-comment / subcomments
- What: Reply to a comment to create nested/threaded subcomments under it.
- Type: feature

### Share a post
- What: Share an existing post (repost / share to feed or external share).
- Type: feature

### Block user
- What: Block a user so their content is hidden and they can't interact with you.
- Type: feature

### Mobile friends-suggestions between posts + show-more modals
- What: On mobile, interleave friends-suggestion cards between feed posts, with "show more" opening suggestion modals.
- Type: feature

### Chat-popup docked windows system
- What: Facebook-style docked chat-popup windows (multiple open chats anchored to the bottom of the screen).
- Type: feature

## Awaiting review

(none)

## Done

(finished items move here, newest on top)

### Auto-play video on scroll into view — DONE
- Merged to main as c3034da (feed videos auto-play muted when ≥60% visible, pause on scroll away, via the existing VideoCoordinator).

### Notify author when their post is removed/banned — DONE
- Merged to main as a80708e ('post-removed' notification to the author on ban, gavel icon, moderator identity hidden).

### Sticky left sidebar on scroll (desktop) — DONE
- Merged to main as 13d9e9c (feed left column position:sticky on desktop; mobile unchanged).

### Like a comment — DONE
- Merged to main as 53a7cb8 (heart like toggle + count per comment; 'comment-like' notification to the comment author).

### Online/offline status dot on users — DONE
- Merged to main as 7173d5e (green/grey presence dot on user + chat avatars via a minimal Socket.io presence layer).

### Multi-step register form — DONE
- Merged to main via PR #1 (3-step MUI Stepper: Account / About you / Location; dropped phone/job/about-me; phone+lastName optional in the shared user-validation API; form password rule aligned to the API's strong rule; button-gap below step fields fixed).

### Video/media in public profile + rename to "media" — DONE
- Merged to main as 798e439 (videos render in the profile media grid; "Photos" → "Media").

### Mobile video posts won't open as modal — DONE
- Merged to main as a0ae628 (transparent tap overlay over feed videos opens the modal on mobile).

### Posts uniform height in feed — DONE
- Shipped: feed media keeps natural aspect ratio with a max-height 600px cap; over-tall media cropped from the top. In CardItem.
- Merged to main as b63773e.
