# Feature expansion examples

Each example shows the full move: the thin request, the expansion thinking (the checklist applied), and the complete build order that gets emitted. Study these to calibrate "how much expansion is enough." Both are drawn from a real social-platform backlog.

---

## Example 1 — "the image zoom is janky, fix it"

**Why this is a trap:** the previous implementation made zoom a *toggle* (one tap = 2x, tap again = back). That is the shallow version this skill exists to prevent. The real feature is gradual, gesture-driven zoom-and-pan like every photo viewer ships.

**Expansion thinking (checklist, condensed):**
- *Reference:* Instagram / iOS Photos / Telegram media viewer — pinch to scale continuously, double-tap zooms toward the tapped point, drag to pan when zoomed, swipe-down to dismiss, backdrop dims with zoom.
- *Entry points:* tap any feed/profile/chat image → fullscreen viewer. In a multi-image post, swipe between images.
- *States:* loading (blurhash/low-res placeholder → full res), error (broken-image fallback), zoomed vs fit.
- *Edge cases:* very tall/wide images, pinch past min/max (clamp with rubber-band), pan boundaries (don't pan image off-screen), single vs multi-image.
- *Responsive:* 390px is gesture-first (pinch, double-tap, drag, swipe-down). 1280px adds scroll-wheel zoom toward cursor, click-drag to pan, Esc to close, click backdrop to close.
- *Accessibility:* Esc closes, focus trapped in viewer, reduced-motion disables the zoom animation but keeps function, alt text announced.
- *Performance:* load full-res lazily; use the already-uploaded Cloudinary transforms for a fast low-res first paint.
- *Enrichment user didn't ask for:* swipe-down-to-dismiss, multi-image swipe, scroll-wheel zoom on desktop.

**Emitted build order:**

```
## Build order: gradual image zoom viewer   [type: bug→feature]

### Context
Current zoom is a 2x toggle; replace with a real gesture-driven viewer.
Images come from Cloudinary (transforms available for low-res placeholders).
Used on feed, profile grid, and chat media.

### Goal
Tapping any image opens a fullscreen viewer over a dimmed backdrop.
- Zoom is CONTINUOUS: pinch (touch) and scroll-wheel toward cursor (desktop)
  scale smoothly between 1x and ~4x, clamped with a slight rubber-band past
  the limits. Double-tap / double-click zooms toward the tapped point and
  toggles back to fit.
- When zoomed in, dragging pans; panning is clamped to image bounds (image
  never leaves a black gap on screen).
- Dismiss: swipe-down (touch), Esc or backdrop-click or a top-right ✕ (desktop).
  Backdrop opacity tracks zoom/drag for a "lift off the page" feel.
- Multi-image posts: swipe / arrow-keys move between images; a dots indicator
  shows position; zoom resets between images.
- First paint shows a low-res Cloudinary transform, then swaps to full res;
  broken image shows a fallback icon, not a blank box.

### Reference standard
iOS Photos / Instagram media viewer: continuous pinch-zoom, double-tap-to-point,
clamped pan, swipe-down dismiss. Desktop adds cursor-anchored wheel zoom + Esc.

### Done-when
- Pinching (390px) scales the image smoothly, not in one jump.
- Double-tap zooms toward the point tapped, double-tap again returns to fit.
- When zoomed, dragging pans and the image never shows an off-image gap.
- Swipe-down dismisses on mobile; Esc / backdrop / ✕ dismiss on desktop.
- In a multi-image post, swipe/arrows change image and dots update; zoom resets.
- Low-res placeholder appears first, full-res replaces it; broken src shows fallback.
- Works at 390px (gesture) and 1280px (wheel + keyboard).

### Decisions
- Max zoom: executor's call, default ~4x.
- Animation lib vs hand-rolled: executor's call; respect reduced-motion either way.

### Verify
- In browser at 390px: pinch, double-tap, pan to edges, swipe-down.
- At 1280px: wheel-zoom toward cursor, drag-pan, Esc, backdrop click.
- Multi-image post: swipe through, confirm zoom resets and dots track.
- Capture both viewports for fit / zoomed / multi-image states.

### Out of scope / guardrails
- Branch only; no main; no master-plan.md; no .env.

### Bookkeeping
- Update backlog.md / today.md per run-instruction.md; log decisions.
```

---

## Example 2 — "add comment replies"

**Thin request, big feature.** A reply is not just a nested comment; it's a threading model, an @mention, a notification, a collapse/expand affordance, and a sort.

**Expansion thinking (checklist, condensed):**
- *Reference:* Instagram threads replies one level deep under each top comment, collapsed behind "View N replies"; replying prefills `@username`; YouTube/Reddit go deeper but Instagram's one-level model fits a social feed and stays scalable.
- *Entry points:* a "Reply" affordance on each comment; tapping it focuses the composer with `@author ` prefilled and scopes the submit to that thread.
- *States:* comment with 0 replies (no "view replies" row), with N replies (collapsed by default with "View N replies" / "Hide replies"), loading replies, optimistic reply insert, error on send (retry), own comment/reply edit+delete via ⋯.
- *Edge cases:* replying to your own comment, deleted parent (show "comment deleted" tombstone if it has replies), very deep @mention chains (still one visual level), thousands of replies (paginate "view more replies" in batches).
- *Data/API:* replies reference a parentCommentId; endpoint to fetch a comment's replies with cursor pagination; reply count denormalized on the parent for the collapsed label.
- *Real-time:* a new reply from another user appears live in an expanded thread and bumps the count on a collapsed one (Socket.io).
- *Notifications:* the parent comment's author gets a "replied to your comment" notification deep-linking to the thread; @mentioned users get notified.
- *Permissions:* anyone who can comment can reply; only the author can edit/delete their reply; server enforces.
- *Responsive:* 390px indents replies modestly (avatar + content), composer docks above keyboard; 1280px shows the thread inline with hover affordances.
- *Accessibility:* reply button is a real button with a label, focus moves to composer on click, thread expand/collapse is keyboard-operable and announces state.
- *Enrichment:* @mention prefill, live count bump, "View/Hide replies" toggle, batched "view more replies".

**Emitted build order:**

```
## Build order: comment replies (one-level threads)   [type: feature]

### Context
Posts already have top-level comments with likes. Add replies as one visual
level of nesting (Instagram model), real-time via the existing Socket.io layer.

### Goal
Each top-level comment gains a "Reply" action. Tapping it focuses the comment
composer with "@<author> " prefilled and scopes the submission as a reply to
that comment.
- Replies render indented under their parent, collapsed by default behind a
  "View N replies" row; tapping expands to "Hide replies". Comments with 0
  replies show no such row.
- Reply count is shown on the row and denormalized on the parent so the
  collapsed label is correct without fetching.
- Replies load with cursor pagination: expanding fetches the first batch, a
  "View more replies" row loads the next.
- Optimistic insert on send (reply appears immediately, reconciles on server
  ack, shows retry on failure). Author can edit/delete their own reply via a
  ⋯ overflow; server authorizes ownership.
- Real-time: a reply from another user appears live in an expanded thread and
  increments the count on a collapsed one.
- Notifications: the parent comment's author receives a "replied to your
  comment" notification deep-linking to the thread; @mentioned users are
  notified. A deleted parent that still has replies shows a "comment deleted"
  tombstone so replies aren't orphaned.

### Reference standard
Instagram comment replies: one visible level, "View N replies" collapse,
@username prefill on reply, scalable batched loading. Not Reddit-style infinite depth.

### Done-when
- Reply on a comment focuses the composer with @author prefilled; submitting
  files it under that comment, not as a new top-level comment.
- A comment with replies shows "View N replies"; expanding/collapsing works and
  is keyboard-operable; a comment with none shows no row.
- Sending a reply shows it immediately; killing the network shows a retry, not
  a silent loss.
- A second browser session replying appears live; the collapsed count bumps live.
- Non-author cannot edit/delete a reply (server rejects, not just hidden UI).
- Parent author gets a notification that deep-links to the thread.
- Correct at 390px (indent + docked composer) and 1280px (inline thread).

### Decisions
- Reply page size: executor's call, default 10.
- Sort of replies: oldest-first (reads as a conversation); executor may follow
  the reference app if it differs.

### Verify
- Two browser sessions: reply from A, confirm B sees it live and the count bumps.
- Force a send failure, confirm retry affordance.
- Attempt edit/delete as a non-author via API, confirm server 403.
- Confirm notification arrives and deep-links.
- Capture 390px and 1280px for: collapsed, expanded, optimistic, empty.

### Out of scope / guardrails
- No second level of nesting in this order (one visual level only).
- Branch only; no main; no master-plan.md; no .env.

### Bookkeeping
- Update backlog.md / today.md per run-instruction.md; log decisions.
```

---

## What to notice across both

1. The thin request named ~10% of the real feature. The order specifies the other 90% — and that 90% is exactly what separates a top-app feature from a shallow one.
2. Every Done-when line is something a human watches happen in a browser. None say "tests pass."
3. Decisions are pre-answered or explicitly delegated, so the executor never stops to ask — the user is never pulled back in mid-build.
4. Both viewports are designed, not hoped for.
5. Security is server-enforced and stated as a Done-when, not assumed.
