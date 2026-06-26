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

### Dry-run smoke task (throwaway)
- What: Create a new file apps/api/src/_autopilot_smoke.js exporting a function add(a, b) that returns a + b. Create a new test file apps/api/tests/_autopilot_smoke.test.js that imports add and asserts add(2, 3) === 5.
- Done when: `npm run test -w apps/api` runs and the new test passes (green).
- Type: logic (tests)