# Guardrails

This file will be expanded later. For now, follow these rules:

1. **Monorepo layout.** `apps/web` is a React/Vite frontend, `apps/api` is an Express/MongoDB backend, and `packages/shared` is shared code used by both.
2. **Import phase.** We are rebuilding an existing app. During the import phase, copy existing code unchanged and do not refactor it.
3. **Small, explained changes.** Keep changes small and explain what you're doing as you go.
4. **No secrets.** Never commit secrets or `.env` files.
