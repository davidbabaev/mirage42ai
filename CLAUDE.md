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