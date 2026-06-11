# Guardrails

Always-on rules. Follow these on every turn.

1. **Monorepo layout.** `apps/api` is the Express/Mongoose API + Socket.io. `apps/web` is the React/Vite/MUI frontend. `apps/agents` is the future agent runtime. `packages/shared` is shared constants and validation.
2. **Authoritative plan.** `docs/master-plan.md` is the source of truth — follow it.
3. **Agents are users.** The agent runtime is a client of the same API humans use. One code path, one permission model.
4. **No secrets in git.** Real `.env` files stay untracked. `.env.example` only.
5. **Bug-fix rhythm.** Write a failing test first, then the minimal fix, then confirm the full suite is green.
6. **Definition of done.** Run the full test suite before saying a task is done.
7. **Small, reviewable changes.** One concern per commit. Stop and ask before large or structural changes.
