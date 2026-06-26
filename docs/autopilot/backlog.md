# Mirage42 — Backlog

Everything we might work on. Add freely. I pull from here into today.md.
Mark items [done] when finished so they drop out of the active list.

## Active

### Infrastructure hardening (deployment task — do with Render staging/production)
- What: Add network-level protection at the host: firewall rules, DDoS/WAF protection (e.g. Cloudflare in front), restrict inbound to required ports, lock down Atlas network access to known IPs.
- Type: infrastructure (not a code task — done at deploy time, verified in the host dashboards)
- Reference: none
- Notes: app-level defenses (rate limiting, validation, helmet headers, XSS/CSRF) live in CLAUDE.md standards; THIS item is the network/infra layer that sits outside the app code.

### Video/media in public profile + rename to "media"
- What: Videos don't appear in the public profile's photos section; also rename that section label from "photos" to "media" since it holds both.
- Type: bug (visual + small logic)
- Reference: docs/autopilot/refs/video-visualphoto.png, docs/autopilot/refs/public-profile-photos.png
- Notes: two parts — (1) make video display, (2) rename label.

### LinkedIn-style suggested/mutual friends modals
- What: "Load more" friends/suggestions opens a popup modal; separate modals for mutual vs suggested; scrollable with scroll-pagination (show more on scroll); users clickable through to their profile; matches LinkedIn-style design; a followed user stays visible ~5 seconds before leaving the list (debounce).
- Type: feature (multi-part — modal + pagination + navigation + debounce + design)
- Reference: docs/autopilot/refs/linkdin-referance-suggested-list.png, docs/autopilot/refs/suggestion-users-publicuserpage.png, docs/autopilot/refs/firends-suggest-feed.png, docs/autopilot/refs/linkdin2-friendssuggest.png
- Notes: NOT a quick bug. Needs its own planning session before it runs.

### Multi-step register form
- What: Remove "about me" from registration; split the form into 2–3 steps with a clean stepper UX for quick registration.
- Type: feature (UX redesign)
- Reference: none
- Notes: form redesign, not a bug fix.

### Infinite scroll across list pages
- What: Replace "load more" buttons with auto-loading infinite scroll (e.g. 30 posts, then 30 more on scroll) with a loading spinner, on all list pages — feed, profiles, all users, all posts.
- Type: phase-d (collides with planned cursor pagination)
- Reference: none
- Notes: DO NOT build ad-hoc. This is the same work as Phase D cursor pagination — belongs there to avoid building it twice.

## Awaiting review

### Mobile video posts won't open as modal
- What: On mobile, a post containing a video does not open into the full-screen modal the way image posts do.
- Type: bug (visual, mobile)
- Reference: docs/autopilot/refs/mobile-post-videonotopen.png
- Notes: combines two doc entries describing the same issue.
- Built on branch autopilot/2026-06-26, commit a0ae628 — awaiting review/merge.

## Done

(finished items move here, newest on top)

### Posts uniform height in feed — DONE
- Shipped: feed media keeps natural aspect ratio with a max-height 600px cap; over-tall media cropped from the top. In CardItem.
- Merged to main as b63773e.
