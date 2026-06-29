# Product patterns: category → reference apps → canonical patterns

Use this to (a) identify the product category in Step 0, and (b) ground feature expansion in how the best apps in that category actually behave. Extract patterns in your own words; never paste app screenshots or copy into a build order.

## Contents
- How to pick the category
- Social platform
- Messaging / chat
- E-commerce / marketplace
- SaaS dashboard / analytics
- Content / media (feed, video, articles)
- Productivity / collaboration
- Dev tool / API product
- Cross-category UX laws

---

## How to pick the category

Ask: what is the core object the user manipulates, and what is the core loop?
- People posting to other people, follow graph, feed → **social platform**
- 1:1 / group conversations, presence, delivery state → **messaging**
- Browse → cart → checkout, listings, sellers → **e-commerce / marketplace**
- Data in, charts/tables out, filters, drill-down → **SaaS dashboard**
- Consume a stream of media, creators, recommendations → **content / media**
- Shared documents/boards/tasks, multiplayer editing → **productivity / collaboration**
- Keys, requests, logs, docs, code → **dev tool / API product**

A product can span categories (a social platform *contains* a messaging surface). Expand each surface against its own category's references.

---

## Social platform
**Reference apps:** Instagram, X / Threads, LinkedIn, Facebook, TikTok, Discord, Reddit.

**Canonical patterns:**
- **Feed item:** author header (avatar, name, handle, time, follow state, ⋯ overflow), media (aspect-preserved, capped height, tap to expand), caption with truncation + "more", action bar (like/comment/share/save), counts that are tappable, comment preview.
- **Like:** optimistic toggle, instant count change, animation, double-tap on media as a second entry point, long-press to see who liked.
- **Comment thread:** top-level comments + nested replies (Instagram collapses replies under "View N replies"; Reddit indents deeply; pick a depth and a collapse model — usually 1 level of visible nesting + "view more"), reply targets a user with an @mention prefilled, sort (top/newest), optimistic insert, own-comment edit/delete via overflow.
- **Share:** sheet with recent contacts first, then search; share to DM, to story/repost, copy link, external (WhatsApp/X/LinkedIn) — external requires a public OG-preview route, not localhost. Link must render a rich preview card, not a bare URL.
- **Block / report:** lives in the ⋯ overflow and in settings; blocking hides content both ways, removes follow, and a blocked user's profile shows a locked/empty state; report has a reason picker.
- **Presence:** online dot on avatars, "active now" / "last seen", a persistent presence bar in chat-enabled products (Discord/Messenger dock).
- **Profile:** header (avatar, name, bio, counts, follow/message buttons), tab strip (posts/media/likes), grid vs list, empty states per tab, own-profile affordances (edit, add post inline).
- **Media zoom:** pinch / scroll to scale *gradually* with pan, not a binary toggle; double-tap to zoom to point; backdrop dim; swipe-down to dismiss.
- **Notifications:** grouped ("X and 3 others liked"), read/unread, deep-link to the source object, badge counts.

---

## Messaging / chat
**Reference apps:** WhatsApp, Messenger, Telegram, iMessage, Discord, Slack.

**Canonical patterns:**
- **Message states:** sending → sent → delivered → read (ticks), failed with retry, optimistic send.
- **Composer:** grows with content, attachment menu, emoji, send disabled when empty, typing indicator broadcast.
- **Thread list:** last message preview, timestamp, unread badge, online dot, pinned/muted, swipe actions.
- **Real-time:** new message arrives live, typing indicators, presence, read receipts, scroll-to-bottom button when scrolled up with new-message pill.
- **Chat dock (web):** persistent bar across pages with presence, expandable conversation popups (Messenger/LinkedIn pattern), not page-restricted.
- **Media in chat:** image/video thumbnails with poster frames, tap to expand, link preview cards.

---

## E-commerce / marketplace
**Reference apps:** Amazon, Shopify storefronts, Etsy, Airbnb, eBay.

**Canonical patterns:** product card (image, price, rating, quick-add), PDP (gallery, variants, stock, reviews, add-to-cart sticky on mobile), cart (line items, quantity steppers, subtotal, remove with undo), checkout (address, payment, review, clear error recovery), search + faceted filters, wishlist/save, seller/listing trust signals, empty cart / no-results states.

---

## SaaS dashboard / analytics
**Reference apps:** Stripe, Linear, Vercel, Datadog, Notion.

**Canonical patterns:** metric cards with trend + comparison period, charts with hover tooltips and legends, filter bar (date range, segment) that persists in URL, data tables (sort, paginate/virtualize, column controls, row actions, bulk select), empty/loading skeletons, drill-down from chart to detail, export. Keep state shareable via URL.

---

## Content / media
**Reference apps:** YouTube, TikTok, Spotify, Medium, Netflix.

**Canonical patterns:** infinite feed with virtualization, autoplay-on-view with mute default, video poster frames, watch/read progress, recommendations rail, save/queue, creator follow, scrubber + controls, captions, picture-in-picture, reading-time/length labels.

---

## Productivity / collaboration
**Reference apps:** Notion, Figma, Linear, Google Docs, Miro.

**Canonical patterns:** multiplayer cursors/presence, optimistic edits with conflict resolution, comment threads anchored to objects, @mentions, activity history, keyboard-first interactions and command palette, undo/redo, share/permission model (view/comment/edit), real-time sync.

---

## Dev tool / API product
**Reference apps:** Stripe, GitHub, Vercel, Postman, Twilio.

**Canonical patterns:** API keys (create/reveal-once/rotate/revoke), request logs with status and timing, copy-paste code samples in multiple languages, webhook config + delivery log + retry, docs with runnable examples, clear error payloads, rate-limit headers, environment/sandbox toggle.

---

## Cross-category UX laws (apply everywhere)

- **Every list has an empty state** with a reason and a next action.
- **Every async action has loading + error + success**; prefer skeletons over spinners for content.
- **Optimistic UI** for actions the user initiates; reconcile/rollback on failure.
- **Destructive actions** get confirmation or undo (undo is friendlier and the modern default).
- **Touch targets ≥ 44px**, visible focus rings, keyboard reachability.
- **Truncate long content** with a clear expand affordance.
- **Server-side authorization** on every permissioned action; the client only hides UI, never enforces.
- **Two real layouts** at ~390px and ~1280px, not one stretched one.
- **Respect reduced-motion**; animations enhance, never block.
