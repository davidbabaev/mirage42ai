# Autopilot — Today's Work

This file is the day's task list for the autopilot.
Each task = what to do + how to know it's done + a type tag.
Clear and rewrite it each day. Git keeps the history.

---

## Example (delete or replace)

### Add avatar to navbar
- What: Show the logged-in user's avatar in the navbar.
- Done when: The avatar appears in the navbar, confirmed on screen
  at mobile width (~390px) and desktop width (~1280px).
- Type: visual (screenshot)

---

## Tasks

### Feed post media height — natural shape with a max cap
- What: Feed post media currently has no height handling. Fix it the way LinkedIn/Twitter feeds work: let each post's media keep its NATURAL aspect ratio (do not force a fixed box, do not stretch). Apply a maximum height cap (use max-height: 600px) to the media container. If media is taller than the cap, crop the overflow anchored to the TOP of the media (object-fit: cover, object-position: top) so the start of the image is visible. Media shorter than the cap displays fully at its natural size. Applies to images and videos, in the shared CardItem component.
- Done when: Normal landscape/square media displays fully at natural shape; only very tall media is capped at 600px and cropped from the top; nothing is stretched or distorted. Confirmed on screen at 390px and 1280px width.
- Reference: docs/autopilot/refs/post-sizes.png, docs/autopilot/refs/post-sizes2.png
- Type: visual (screenshot)