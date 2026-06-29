# Autopilot — Today's Work

This file is the day's task list for the autopilot.
Each task = what to do + how to know it's done + a type tag.
Clear and rewrite it each day. Git keeps the history.

<!-- TASK FORMAT:
### Task title
- What: clear description of the change.
- Decisions: pre-answer any choices you care about (fields, behavior, look, edge cases). Anything not listed here, the agent decides itself and logs in its report.
- Done when: how to verify it's actually working.
- Type: logic | visual | feature
-->

## Tasks

### T3 — Notifications: delete-button bug + comment copy fix
- What: In `Notifications.jsx`, stop the delete (trash) IconButton click from bubbling to the row (`e.stopPropagation()`) so deleting no longer navigates to the sender's profile. Fix the `comment` actionType text from "commentd your post" to "commented on your post".
- Decisions: keep delete optimistic; roll back on API failure. No other behavior change in this task.
- Done when: a web component test asserts clicking the delete button calls delete and does NOT trigger navigation; the `comment` text reads "commented on your post"; suite green.
- Type: logic

### T4 — Notifications: deep-link to post + comment anchor
- What: Clicking a like/comment notification about your post opens THAT post via the existing `CardPopupModal` (`/allcards?card=<whichCard>`), not the sender profile. Clicking a comment-like/comment-reply notification opens the post AND scrolls to + briefly highlights the specific comment. Persist the relevant `commentId` on comment-like/comment-reply notifications (add field on creation in `cardsSvc`) and read a new `?comment=<id>` param in `AllCardsPage`/`CardPopupModal` to scroll+highlight (fade after ~2s). Follow-notifications still go to the profile.
- Decisions: highlight = brief background flash + non-color cue; if the comment isn't found (deleted), open the post anyway. Reuse the existing `?card=` deep-link plumbing.
- Done when: clicking a like/comment-on-your-post notif opens that post; clicking a comment-reply/comment-like notif opens the post scrolled to the highlighted comment; clicking a follow notif still opens the profile; verified in browser at 390px and 1280px.
- Type: visual

### T5 — Notification settings (per-type preferences)
- What: Add `User.notificationPrefs` (per-type booleans: likes, comments, follows, commentLikes, commentReplies — all default true). Gate notification CREATION server-side on the recipient's prefs (in `cardsSvc`/follow notification writes). Add `PATCH /users/me/notification-prefs` and a settings UI (in the existing dashboard/settings area) with toggles.
- Decisions: default all true (opt-out model, like real apps). Gating happens at creation time (don't store-then-hide). post-removed/admin notifications are NOT user-suppressible.
- Done when: tests — toggling a type off stops new notifications of that type for that user; others still arrive; settings UI persists and reflects state; verified in browser at 390px and 1280px for the settings screen.
- Type: feature

### T6 — Likes list endpoint
- What: Add `GET /cards/:id/likes?cursor=&limit=` returning the users who liked a post — minimal profile (avatar, name, job, followersCount) + `isFollowing` for the requester — block-aware (either direction), paginated for scale (assume 100k+ likers; never return all at once).
- Decisions: cursor pagination consistent with existing list endpoints; default limit 20; exclude blocked-either-way likers from the list.
- Done when: tests — endpoint returns liker rows with isFollowing, paginates, and omits blocked users; 404 for a hidden/blocked card; suite green.
- Type: logic

### T7 — Likes-count modal (clickable likes → PeopleModal)
- What: Make the "N likes" count + avatar cluster a button in `CardItem.jsx` and `CardDetailsModal.jsx`; clicking opens a modal (reuse `PeopleModal`) listing likers from `GET /cards/:id/likes`, each row: avatar, name, job, follower count, Follow button (or "Following" text), matching `refs/likes-count-modal.png`. Paginated scroll; optimistic follow from inside the modal.
- Decisions: 0 likes → not clickable. Reuse PeopleModal exactly; don't fork a new list UI.
- Done when: clicking "N likes" opens a likers modal with working Follow/Following; scroll paginates; matches the ref design; verified in browser at 390px and 1280px.
- Type: visual

### T8 — Report-a-post backend
- What: Add a `Report` model `{ cardId, reporterId, reason, createdAt }` with a unique index on (cardId, reporterId). `POST /cards/:id/report` (reason validated against an allowlist enum) — one report per user per post (dedupe → idempotent/409). Maintain a per-post report count (denormalized `reportCount` on the card or an aggregate). Create an admin-targeted Notification on each new report (new actionType `post-reported`). `GET /cards/:id/reports` — admin-only — returns reporter identities + reasons.
- Decisions: reason allowlist = spam, harassment, nudity/sexual, hate, violence, misinformation, other. `GET /cards/:id/reports` requires isAdmin (authorization, not just auth). Admin notification recipients = all admins — pick one inbox model and log it.
- Done when: tests — a user can report once (second attempt deduped); reason validated; reportCount increments; admin notification created; non-admin gets 403 on `GET /cards/:id/reports`; suite green.
- Type: logic

### T9 — Report-a-post UI
- What: Add a ⋯ overflow menu on the post (introduce a reusable one if absent) with "Report post"; opens a reason picker dialog (radio group of the allowlist), submit shows pending → success toast → auto-close. If already reported, show an "already reported" state (disabled/secondary).
- Decisions: auto-close the dialog on success (real-app standard). Reasons from the backend allowlist. Don't allow reporting your own post.
- Done when: a user reports a post via the overflow → reason → success + auto-close; cannot report the same post twice (UI reflects it); verified in browser at 390px and 1280px.
- Type: visual

### T10 — Admin: report column + reporter list
- What: In `AdminCardsPanel.jsx`, add a "Reports" column showing each post's report count (muted when 0); clicking a non-zero count opens a modal listing who reported and why (from `GET /cards/:id/reports`). Surface `post-reported` admin notifications in the admin's notification view.
- Decisions: clicking the count opens a modal (loading/empty/error states); reporter rows show name + reason + time.
- Done when: admin table shows report counts; clicking a count lists reporters + reasons; new reports appear as admin notifications; verified in browser at 390px and 1280px.
- Type: visual

### T11 — Block user from chat 3-dot menu
- What: Add a "Block user" item to the chat ⋯ menu in `ChatHeader.jsx` (alongside Profile + Delete chat) and add a ⋯ menu with Profile / Block / Delete to `DockedChatWindow.jsx` (currently has none). Reuse `useBlockUser().toggleBlock(otherUserId)`. Confirm before blocking (reuse `ConfirmationDialog`); on success show a toast and close/leave the conversation (it disappears from the list/dock per the block-hardening change).
- Decisions: confirm-before-block (real-app standard). Cannot block self. Dock menu is desktop-only (dock is hidden on mobile already).
- Done when: from an open conversation (full chat AND dock) the ⋯ menu shows Block; choosing it confirms, blocks, closes the conversation, and the thread leaves the list/dock; verified in browser at 390px (full chat) and 1280px (full chat + dock).
- Type: visual

### T12 — Fullscreen zoomable chat images
- What: Tapping an image message in `MessageList.jsx` (and the dock's message list) opens it fullscreen in a MUI Dialog wrapping the existing `ZoomableImage` (react-zoom-pan-pinch, already installed). Gradual scroll/pinch/double-tap zoom + pan; dark backdrop; close via X / backdrop / Esc / swipe-down. Loading spinner while the full image loads.
- Decisions: reuse `ZoomableImage` + `MediaDisplay`'s existing `zoomable` branch; don't add a new lightbox library. Zoom is gradual with limits (not a binary toggle).
- Done when: clicking a chat image opens a fullscreen viewer that zooms gradually in/out with pan (scroll+double-click desktop, pinch+double-tap mobile) and closes via X/backdrop/Esc; works from full chat and dock; verified in browser at 390px and 1280px.
- Type: visual
