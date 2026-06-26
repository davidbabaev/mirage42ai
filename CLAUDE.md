# Guardrails

Always-on rules. Follow these on every turn.

1. **Monorepo layout.** `apps/api` is the Express/Mongoose API + Socket.io. `apps/web` is the React/Vite/MUI frontend. `apps/agents` is the future agent runtime. `packages/shared` is shared constants and validation.
2. **Authoritative plan.** `docs/master-plan.md` is the source of truth — follow it.
3. **Agents are users.** The agent runtime is a client of the same API humans use. One code path, one permission model.
4. **No secrets in git.** Real `.env` files stay untracked. `.env.example` only.
5. **Bug-fix rhythm.** Write a failing test first, then the minimal fix, then confirm the full suite is green.
6. **Definition of done.** Run the full test suite before saying a task is done.
7. **Small, reviewable changes.** One concern per commit. Stop and ask before large or structural changes.

## Debugging discipline
- This is a visual web app. A passing jsdom/unit test is NOT proof that a visual or runtime behavior works. Verify visual/video/browser-runtime changes in a real browser (Playwright MCP) before claiming a fix is done. If you can't observe it, say so and ask me to verify — never assert success you haven't seen.
- After two failed fix attempts on the same bug, STOP writing fixes and switch to diagnosis: state what you now believe the root cause is, what you already tried and why each failed, and what information is still missing. Then propose ONE targeted fix.

## Responsive design
- All UI must work well on both mobile and desktop. Build mobile-first, use the existing MUI breakpoint system (xs/sm/md/lg) and useMediaQuery rather than ad-hoc media queries, and keep touch targets comfortable on mobile.
- When a layout genuinely differs between screen sizes (e.g. chat: two-pane on desktop, full-screen navigation on mobile), design and build both deliberately — don't just shrink the desktop layout.
- Verify UI changes in a real browser at BOTH a mobile viewport (~390px) and a desktop viewport (~1280px) before claiming done.

## Token discipline

- Delegate exploration. When locating code, tracing how something works, or reading more than ~3 files to answer a question, launch a search/Explore subagent and work from its summary. Do not read many files directly in the main thread.
- Delegate test and build runs to a subagent; report back only pass/fail and the failing cases, not the full log.
- Keep the main session for decisions, design, and writing code — the work that needs full reasoning.
- When a subagent reports back, keep the conclusion, drop the raw file dumps.

## Engineering standards

Apply these to every task — features and bug fixes alike. They are not optional.

### Security
- Validate and sanitize all input on the server. Never trust data from the client.
- Use Mongoose query builders / parameterized queries — never build queries from raw string concatenation (prevents injection).
- Passwords are HASHED, never encrypted or stored plaintext — use bcrypt/argon2, one-way only.
- Encryption: enforce HTTPS for all traffic (in transit); rely on Atlas encryption at rest; never log or expose sensitive fields.
- Never put secrets, keys, or tokens in code or commits. Read them from env.
- Enforce authentication AND authorization on every protected route — confirm the user is allowed to do this specific action, not just that they're logged in.
- Defend against the common attack classes: escape/encode output to prevent XSS, protect state-changing routes against CSRF, keep rate limiting on auth and write endpoints, set security headers (use the helmet middleware).
- Never expose internal error details or stack traces to the client.
- Prefer well-maintained libraries over hand-rolled security code.

### Architecture & code quality
- Follow the patterns already in this codebase. Match the existing structure; don't invent a parallel one.
- Separation of concerns: route handlers stay thin → services hold business logic → models handle data. Don't mix the layers.
- Single responsibility: each function/module does one thing. If it does three, split it.
- No copy-paste duplication (DRY). Reuse via shared functions/components.
- Fail fast and handle errors explicitly — no silent catches that swallow problems.
- Keep functions pure where possible; isolate side effects (DB, network) so logic is testable.
- Name things clearly and consistently. Code is read far more than written.
- Every new feature or bug fix ships with a test that covers it.

### Performance hygiene
- No N+1 database queries. Fetch related data in one query, not in a loop.
- Select and return only the fields actually needed — don't over-fetch.
- Index fields that are queried or sorted on frequently.
- Paginate large lists; never load an unbounded collection into memory.
- Don't add work to hot paths (requests, renders) without reason; avoid unnecessary re-renders on the frontend.

### Responsiveness (UI tasks)
- Mobile-first: design for small screens, then scale up.
- Every visual change is verified at mobile width (~390px) AND desktop width (~1280px) before it's done.
- Nothing should overflow, overlap, or become unreachable on small screens.
- Touch targets large enough for fingers; no hover-only interactions on mobile.