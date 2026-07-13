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

## Plan — the folder/naming sweep (master-plan #20)

Master-plan #20: *"Folder/file reorganization + naming sweep (the misspellings, casing, 'reusable components' space) — done LAST in D, when the architecture has settled. ONE restructure."*

The architecture has now settled: the provider-retirement epic is merged to main, so the file layout has stopped moving. This is that one restructure.

**Scope discipline.** This is a rename/cleanup pass — NO behavior changes, except where a "typo" turns out to be an actual bug (task 1). Each rename is its own commit so a bad one can be reverted alone. The full suites must stay green after every task.

**Deliberately OUT of scope** (organizational preference, not errors — churn without value):
- `components/chatDock/` — looks odd but actually FOLLOWS the convention (multi-word folders are camelCase).
- `pages/landing/` (a folder holding one file) and `pages/docs/pages/` (a redundant nesting). Harmless; leave them.

---

## Tasks

### 1. Typos that are actually BUGS (not cosmetics)
- What: The sweep turned up misspellings that silently break behavior or ship broken text to users. Fix them first, separately from the renames.
  - `color='text.secondaty'` in **UserProfileLayout.jsx, FeedPage.jsx, UserReusableCard.jsx, DashboardLayout.jsx** — MUI silently DROPS an unknown palette key, so this text was never actually greyed out. → `text.secondary`.
  - `id='loginGradiant'` + `fill='url(#loginGradiant)'` in **LoggedInThirtyDays.jsx** — id and reference agree with each other, so the gradient does work; rename both to `loginGradient` anyway.
  - `'...showless'` rendered to users in **CardItem, CardDetailsModal, FavoriteCards, MyCardsSection, TopAndLastFiveCardReuse** → `'...show less'` (missing space).
  - `"Posts per catrgories"` heading in **CountPostsByCategoriesList.jsx** → `"Posts per categories"`.
  - Admin result messages in **UsersProvider.jsx**: `"User banned succefully"` → `successfully`; `'User becam admin successfully'` → `became`.
- Decisions: `text.secondaty` → `text.secondary` is a real VISUAL fix — that text will now actually render muted. That's the intended behavior, not a regression.
- Done when: no `secondaty` / `showless` / `catrgories` / `succefully` / `becam` anywhere in apps/web/src. Full suites green.
- Type: logic

### 2. `reusable components/` → `shared/` (the space in the folder name)
- What: `apps/web/src/pages/adminUserDashboard/components/reusable components/` — a folder with a SPACE in its name, nested inside `components/` (components of components). Rename to `shared/`. Also fix the misspelled file + component inside it: `MostPupularCardReuse` → `MostPopularCardReuse` (file name AND the exported component symbol).
- Decisions: `shared/` over `reusable/` — drops the space AND the vague descriptor. 4 importers, all co-located in the same `components/` folder: MostPopular, TotalAnalytics, TopAndLastFiveCards, RetentionAnalyticsUsers.
- Done when: no path with a space anywhere in the repo; the 4 imports resolve; admin Overview panel still renders. Full suites green.
- Type: logic

### 3. Case-only renames (need a two-step `git mv`)
- What: Two renames that change ONLY the casing of a single letter. On Windows/WSL the filesystem is case-insensitive, so a direct `git mv` silently no-ops and leaves the index out of sync — each needs an intermediate temp name.
  - `apps/api/src/cards/validation/Joi/` → `joi/` (its sibling `users/validation/joi/` is already lowercase). 1 importer: cardsRoutes.js.
  - `apps/web/src/pages/adminUserDashboard/AdminOverViewPanel.jsx` → `AdminOverviewPanel.jsx` ("Overview" is one word). 1 importer: AdminDashboardLayout.jsx (+1 JSX use). Rename the exported component too.
- Decisions: use the two-step (`git mv X _tmp && git mv _tmp x`) and VERIFY with `git status` that git actually recorded the rename — a silent no-op here is the whole trap.
- Done when: `git log --stat` shows the renames; imports resolve; full suites green.
- Type: logic

### 4. `Notifications.js` model → `Notification.js`
- What: `apps/api/src/notifications/models/Notifications.js` is the only PLURAL model file — every other one is singular (Card.js, User.js, Message.js, Conversation.js, Report.js). The Mongoose model inside is already named `Notification`; only the file name is wrong.
- Decisions: widest blast radius in this sweep — 7 importers (cardsSvc, usersSvc, reportSvc, notificationsSvc + 3 test files). Its own commit so it can be reverted alone.
- Done when: all 7 importers updated; API suite green.
- Type: logic

### 5. Page names that lie about what they are
- What: Two pages whose names actively mislead, plus one dead file.
  - `CardsRegisterPage.jsx` → `CreateCardPage.jsx` — it renders the card-creation form at `/createnewcard`. ("Register" is the old internal term for creating a post.)
  - `RegisteredPage.jsx` → `SignUpPage.jsx` — it's the multi-step user SIGN-UP form; the current name reads like a post-signup success screen.
  - `HomePage.jsx` — DELETE. Nothing imports it; it's an old wireframe skeleton (placeholder text, an "iamges" typo).
- Decisions: 1 importer each (App.jsx). Deleting dead code belongs in a restructure — a stale wireframe is exactly the confusion this sweep exists to remove.
- Done when: App.jsx imports resolve; routes still work; no references to HomePage remain. Full suites green.
- Type: logic

### 6. Misspelled internal symbols
- What: Not user-facing, but wrong, and they make the code hard to grep:
  - `useAnalytics.js`: `arrayGroupUsersRegistarationByMonth` → `...Registration...` (also destructured in UserRegistrationByMonths.jsx); `groupUsersRegistarationByMonth` → `...Registration...`; `thertyDaysInMs`/`dateThertyDays`/`ThertyDays` → `thirty...`; `moreThenSevenDays`/`moreThenSevenDaysCount` → `moreThan...` (also destructured in RetentionAnalyticsUsers.jsx).
  - `NavBar.jsx` + `AdminNavBar.jsx`: `isProfileAvaterOpen`/`setIsProfileAvaterOpen` → `...Avatar...`.
  - `ProfileSection.jsx`: `editprofilePicture`/`setEditprofilePicture` → `editProfilePicture`/`setEditProfilePicture`.
  - Comment typos while in the file: "scoket"→socket, "conenction"→connection, "cahrt"→chart, "flase"→false, "testerday"→yesterday.
- Decisions: rename the symbol at EVERY reference — a partial rename is worse than none.
- Done when: no `Registaration`/`Therty`/`moreThen`/`Avater`/`editprofilePicture` anywhere. Full suites green.
- Type: logic

### 7. Verify the restructure in a real browser
- What: A rename sweep is exactly the change that passes every test and still ships a blank screen (a missed import path; a case-only rename git never recorded). Verify in a real browser.
- Decisions: reuse the harness pattern from the merge-prep sweep — boot the API against a throwaway in-memory Mongo (NEVER Atlas, NEVER David's running dev servers), seed, log in through the real form, and load the touched surfaces at 390 and 1280: feed, admin Overview (the `shared/` folder + AdminOverviewPanel rename), sign-up page, create-post page, and the profile/dashboard pages that had the `text.secondaty` fix. Assert ZERO console errors.
- Done when: every touched surface renders with no console errors at both widths, and the previously-broken muted text actually renders muted.
- Type: visual

---

## After this run (own orders, in this sequence)

1. **TASK B — DMs fail after a long session** — diagnose-only session (likely token/socket-auth expiry).
2. **Phase E — deployment**: Dockerized local env · staging + prod hosting · Sentry · Playwright smoke pack · domain/HTTPS/deploy pipeline. Unlocks the **network/infra hardening** item.
   - The throwaway browser harness (used twice now: merge-prep sweep, and task 7 above) should become the CHECKED-IN Playwright smoke pack here. It has caught two bugs that ~190 unit tests could not.
3. **Admin analytics aggregation endpoints** — the debt taken deliberately in the provider-retirement run.

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch. (`apps/agents` does not exist yet; `packages/shared` is still an empty .gitkeep.)
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.
