# Codebase Audit — Read-Only Diagnostic Pass

This is a factual inventory of the imported `apps/api` (Express/Mongoose) and `apps/web` (React/Vite) codebases. **No code was modified.** The audit was produced by running ESLint where configured, grepping the source tree for dead-code and risky-pattern signatures, and spot-reading flagged files.

Findings are organized into four sections (A–D), with **Backend** and **Frontend** subsections in each. Every claim cites a file path and (where applicable) a line number.

---

## Highlights — read this first

The handful of items most worth fixing before any other cleanup, ranked by impact:

1. **Backend: silent hang in `DELETE /notifications/:id`** — no response if the auth condition is false (`apps/api/src/notifications/routes/notificationsRoutes.js:35–46`).
2. **Backend: socket handler will crash the process** — `socket.on('send-message')` is async with no try/catch (`apps/api/src/chat/routes/chatSocket.js:35–44`).
3. **Backend: boot still couples to Google OAuth** — `googleStrategy.js:7–11` instantiates the strategy at module load and crashes the process if `GOOGLE_CLIENT_ID`/`SECRET` are empty (we already hit this).
4. **Frontend: 64 ESLint errors + 11 warnings** — including a confirmed duplicate-key bug, missing `key` props in `.map()`, a constant-binary-expression logic bug, ~29 unused imports, and ~7 "setState in effect" hook violations.
5. **Frontend: provider files violate Fast Refresh** — non-component exports in `AuthProvider`, `CardsProvider`, `ThemeProvider`, `UIProvider`. Cheap to fix, big DX win.
6. **Both apps: leftover `console.log` debug statements**, hardcoded CORS origins/URLs, empty stub files, and one misspelled filename (`userVlidationsService.js`).

---

## A. Lint

### Backend (`apps/api`)

**No ESLint config exists** in `apps/api`. Lint was therefore skipped — no baseline to report against.

If lint coverage is desired, a flat-config `eslint.config.js` would need to be added (out of scope for this read-only audit).

### Frontend (`apps/web`)

`eslint.config.js` is present. `npx eslint .` reports **75 problems: 64 errors, 11 warnings.**

Grouped by rule, the material findings:

#### `react-hooks/set-state-in-effect` (7 errors) — `setState` called synchronously inside `useEffect`
- `src/hooks/useCities.js:40`
- `src/hooks/useCountries.js:38`
- `src/hooks/useFavoriteCards.js:36`
- `src/hooks/useSelectedUsers.js:35`
- `src/hooks/useNotifications.js:43`
- `src/pages/LoginPage.jsx:23`
- `src/pages/FeedPage.jsx:58`
- `src/pages/chat/ChatPage.jsx:151, 203`
- `src/pages/dashboard/ProfileSection.jsx:98, 116`
- `src/providers/CardsProvider.jsx:26, 33`
- `src/providers/UsersProvider.jsx:91`

#### `no-unused-vars` (~29 errors) — imports/state declared but never used
Selected examples (full list in lint output):
- `src/components/CardItem.jsx:2` — `useFavoriteCards`
- `src/components/CardsComments.jsx:1` — `useRef`
- `src/components/NavBar.jsx:31` — `setIsChatOpen`
- `src/components/UserReusableCard.jsx:6` — `useSelectedUsers`
- `src/pages/HomePage.jsx:1` — `useState`
- `src/pages/RegisteredPage.jsx:13` — `useThemeContext`
- `src/pages/AllCardsPage.jsx:253` — `index`
- `getFollowingCount` unused in 5 files (`CardItem`, `CardsComments`, `CardDetailsModal`, `UserProfileLayout`, `LastFiveJoinedUsers`)

#### `react-hooks/exhaustive-deps` (7 warnings)
- `src/components/CreateCardForm.jsx:58` — missing `mediaButton`
- `src/hooks/useCities.js:44` — missing `fetchCitiesList`
- `src/pages/FeedPage.jsx:59` — missing `isUserDataFill`, `user`
- `src/pages/LoginPage.jsx:25` — missing `errorParam`
- `src/pages/adminUserDashboard/AdminCardsPanel.jsx:134` — missing `favoriteCards` in `useMemo`
- `src/pages/adminUserDashboard/AdminUsersPanel.jsx:146` — missing `registeredCards` in `useMemo`
- `src/pages/chat/ChatPage.jsx:182, 226` — missing `handleOpenChatList`, `setSearchParams`

#### `no-dupe-keys` (2 errors)
- `src/pages/dashboard/SelectedPage.jsx:23–24` — `py: 3` and `gap: 2` each appear twice in the same `sx` object literal. Later values silently override earlier ones. (Already surfaced during dev server boot.)

#### `react-refresh/only-export-components` (4 errors)
Non-component exports from provider files break Fast Refresh:
- `src/providers/AuthProvider.jsx:164` — exports `useAuth()`
- `src/providers/CardsProvider.jsx:217` — exports helper functions
- `src/providers/ThemeProvider.jsx:25` — exports theme config
- `src/providers/UIProvider.jsx:16` — exports helper functions

#### Other notable errors
- `src/pages/FeedPage.jsx:43` — `no-constant-binary-expression`: `user?.address.country === "Not Defined" && ""` is a logic bug (always falsy). Almost certainly meant `||`.
- `src/providers/CardsProvider.jsx:33` — effect calls `refreshFeed()` before its declaration on line 38 (works by hoisting, but flagged).
- `src/pages/chat/ChatPage.jsx:79` — `useCallback` dependency mismatch.

---

## B. Dead / Unused Code and Files

### Backend (`apps/api`)

- **Empty stub files** (0 bytes — never imported, look like refactoring leftovers):
  - `src/users/validation/userVlidationsService.js`
  - `src/cards/validation/cardValidationsService.js`
- **Unused backup route file**:
  - `src/users/routes/backup.js` — never imported anywhere.
- **Debug `console.log` statements left in service / route code**:
  - `src/chat/service/chatSvc.js:51, 58`
  - `src/chat/routes/chatRoutes.js:45`
  - `src/auth/googleStrategy.js:19, 47`
  - `src/auth/googleRoutes.js:16, 21`
  - `src/cards/routes/cardsRoutes.js:43, 71, 82` (these are in `catch` blocks — arguably acceptable, but inconsistent with the central `handleError`).

### Frontend (`apps/web`)

- **Commented-out code blocks (3+ consecutive lines)**:
  - `src/pages/chat/ChatPage.jsx:154–168` — commented `useEffect` (auto-scroll).
  - `src/pages/chat/ChatPage.jsx:170–174` — commented `useEffect` (scroll timing).
  - `src/pages/userProfilePublicLayout/UserProfileFollowers.jsx:122–145` — ~20-line commented JSX return block.
- **Commented-out exports**:
  - `src/services/apiService.js:101` — `getCard()` is commented out.
- **Debug `console.log` statements**:
  - `src/providers/CardsProvider.jsx:21, 47`
  - `src/providers/AuthProvider.jsx:28` — `console.log(userGoogle)`
  - `src/pages/chat/ChatPage.jsx:67, 179, 215–217`
  - `src/hooks/useChat.js:22, 33, 58, 88`
  - `src/hooks/useCities.js:26, 30`
  - `src/hooks/useCountries.js:27, 30`
  - `src/services/socketService.js:16, 20`

---

## C. Likely Bugs / Risky Patterns

### Backend (`apps/api`)

1. **`DELETE /notifications/:id` can hang the client** — `src/notifications/routes/notificationsRoutes.js:35–46` sends `res.send()` inside an `if`; if the condition is false, no response is ever sent.
2. **Socket handler will crash the process on rejection** — `src/chat/routes/chatSocket.js:35–44` registers an async `socket.on('send-message')` handler with no try/catch. If `getOrCreateConversation()` or `createNewMessage()` reject, the rejection is unhandled.
3. **Conditional response without early return** — `src/users/routes/usersRoutes.js:69–115` (PUT `/users/:id`) sends `res.send()` inside an `if` block without `return`; execution can continue into subsequent logic.
4. **Module-load-time crash from empty OAuth config** — `src/auth/googleStrategy.js:7–11` instantiates `new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, ... })` at import time. Empty `clientID` → `TypeError` → process exits at boot. (Already encountered.) Same problem latent for `SERVER_URL` (used to build `callbackURL`).
5. **CORS origins hardcoded** — `src/app.js:32–40` and `src/middlewares/cors.js:5–10` list production URLs in source. Should be env-driven.
6. **Hardcoded image URLs as defaults** — `src/users/helpers/normalizeUser.js:5–6` (long avatar URLs); `src/cards/helpers/normalizeCard.js:4` (placeholder image). Brittle if those host paths change.
7. **Missing-import pattern risk** — we already fixed `normalizeUser` undefined in `usersSvc.js`. No other instances were found, but the pattern is worth a wider grep before any module renames.

### Frontend (`apps/web`)

1. **Duplicate `sx` keys** — `src/pages/dashboard/SelectedPage.jsx:23–24`: `py` and `gap` each declared twice. The second wins silently — visual layout is whatever the *second* value gives, not what the developer who wrote the first one expected.
2. **Constant-binary-expression logic bug** — `src/pages/FeedPage.jsx:43`: `user?.address.country === "Not Defined" && ""` is always falsy. Almost certainly meant `||`. The page's "user data complete?" check is therefore unreliable.
3. **Missing `key` props in `.map()`**:
   - `src/pages/userProfilePublicLayout/UserProfileFollowing.jsx:44`
   - `src/pages/adminUserDashboard/AdminUsersPanel.jsx:398` — only `indexM` parameter, no `key`.
4. **Async handlers without error handling**:
   - `src/pages/userProfilePublicLayout/UserProfileFollowing.jsx:91–94` — `onClick={async () => { await toggleFollow(...); await refreshFeed(); }}` with no `try/catch`. Rejection is silently swallowed; failures are invisible to the user.
   - Similar pattern in several other `onClick` handlers across `ChatPage`, `FeedPage`.
5. **State updates after unmount risk** — multiple `useEffect` hooks fetch async and `setState` with no cleanup / cancellation token. Files: `useCities.js`, `useCountries.js`, `useFavoriteCards.js`, `useNotifications.js`, `useSelectedUsers.js`, `ChatPage.jsx`, `ProfileSection.jsx`, `FeedPage.jsx`.
6. **Forward reference in effect** — `src/providers/CardsProvider.jsx:30–35` calls `refreshFeed()` before its declaration on line 38. Works via hoisting, but is a maintenance hazard.

---

## D. Structural / Architectural Concerns

### Backend (`apps/api`)

1. **Inconsistent folder casing** — same concept, different cases:
   - `src/cards/validation/Joi/` (uppercase)
   - `src/users/validation/joi/` (lowercase)
2. **Misspelled filename** — `src/users/validation/userVlidationsService.js` ("Vlidations").
3. **Empty placeholder files** — both `userVlidationsService.js` and `cardValidationsService.js` are 0 bytes. Either delete or actually implement.
4. **Inconsistent error-handling style** — services `throw`, route catches call `handleError(res, err)` (good), but some routes also `console.log` after `handleError` (redundant), and socket handlers have no error handling at all.
5. **No centralized notification creation** — both `usersSvc.js` and `cardsSvc.js` instantiate `Notification` objects directly. A `notifications/service` exists but isn't used from outside its own routes. Couples two domains to the `Notification` model directly.
6. **No ESLint config** — no static-analysis baseline at all on the backend.

### Frontend (`apps/web`)

1. **Folder name contains a space** — `src/pages/adminUserDashboard/components/reusable components/`. Breaks `import` paths in some tooling, looks like a typo, inconsistent with the rest of the tree.
2. **Provider files mix component + hook + config exports** — `AuthProvider`, `CardsProvider`, `ThemeProvider`, `UIProvider` each export their hook (`useAuth`, etc.) alongside the component. This is the root cause of the 4 `react-refresh/only-export-components` errors. Standard fix: split hooks into their own files.
3. **No error boundaries** around data-fetching pages (`FeedPage`, `AllCardsPage`, `ChatPage`, profile pages). One unhandled render error tears the whole tree down.
4. **Mixed state management** — Context API + localStorage hydration is used in `AuthProvider`, `CardsProvider`, `UsersProvider`, with overlapping responsibilities (e.g., `cards` and `feed` state). No clear separation between domain state and UI state.
5. **Mixed component definition styles** — function declarations vs arrow functions vs default exports vs named exports. No enforced convention.
6. **Accessibility regressions**:
   - `src/pages/chat/ChatPage.jsx:605` — `<input type="file">` hidden with `display: 'none'` but no labelled visible trigger.
   - Several async `onClick` handlers don't communicate loading / disabled state.
7. **`.env` and the API base URL** — `.env` holds `VITE_API_URL=http://localhost:8181`. The code correctly reads `import.meta.env.VITE_API_URL`, so this is fine — but there's no `.env.production` / build-time override pattern yet.

---

## What's not in this audit

- **Runtime bug verification.** Findings are static. I have not exercised each route/page to confirm every "likely bug" produces user-visible breakage.
- **Performance / bundle analysis.** Not in scope for this pass.
- **Security review.** This is not a security audit. Some risky patterns are noted (NoSQL injection surface, hardcoded URLs, missing rate-limiting), but a real security review would go deeper.
- **`packages/shared`** is empty and not part of this audit.
- **Frontend asset usage.** Not every PNG/SVG under `src/assets/` was traced to a consumer; a few may be unused but were not exhaustively verified.

---

## Suggested cleanup ordering (when you're ready)

Roughly cheapest → highest-leverage:

1. Delete the empty stub files and the unused `backup.js`.
2. Fix the duplicate `sx` keys in `SelectedPage.jsx` and missing `key` props.
3. Add the missing `return`/response in `DELETE /notifications/:id` and the user PUT route.
4. Wrap the socket handler in try/catch.
5. Make the Google OAuth strategy lazy / conditional so the server boots without OAuth creds.
6. Split provider hooks into separate files to fix the 4 Fast Refresh errors.
7. Sweep the ~29 unused imports and ~7 effect-deps warnings.
8. Standardize folder casing and rename the misspelled `userVlidationsService.js` and the `reusable components` folder.
9. Add an ESLint config to `apps/api` so future drift is caught.
10. Centralize CORS origins and image defaults into env / config.
