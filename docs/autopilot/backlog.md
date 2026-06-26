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

## Awaiting review

### Multi-step register form
- What: Remove "about me" from registration; split the form into 2–3 steps with a clean stepper UX for quick registration.
- Type: feature (UX redesign)
- Reference: none
- Notes: form redesign, not a bug fix. Shipped as a 3-step MUI Stepper (Account / About you / Location); also removed phone + job, made phone/lastName optional in the shared user-validation API, and aligned the form's password rule to the API's strong rule.
- Built on branch autopilot/2026-06-26, commit 1d0d45b — awaiting review/merge.

## Done

(finished items move here, newest on top)

### Video/media in public profile + rename to "media" — DONE
- Merged to main as 798e439 (videos render in the profile media grid; "Photos" → "Media").

### Mobile video posts won't open as modal — DONE
- Merged to main as a0ae628 (transparent tap overlay over feed videos opens the modal on mobile).

### Posts uniform height in feed — DONE
- Shipped: feed media keeps natural aspect ratio with a max-height 600px cap; over-tall media cropped from the top. In CardItem.
- Merged to main as b63773e.
