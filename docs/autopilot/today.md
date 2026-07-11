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

## Plan — recommended execution order

Working top-down. One concern per commit; test-first for logic; browser-verify visual at 390/1280; full suite green before "done".

### 4. Retire global load-everything providers
- What: Remove `getAllUsers`/`getAllCards` mount-time full-collection loads (counts are now server-side); anything still depending on them migrates to scoped/paginated queries.
- Done when: no provider loads a full collection on mount; suite green.
- Type: logic

### 5. Folder / naming sweep
- What: One restructure — misspellings, casing, "reusable components" naming. Done LAST, after the architecture settles.
- Type: logic

### 6. Network / infra hardening  (deploy-time, not app code)
- What: Firewall / WAF (Cloudflare) / restrict inbound ports / lock Atlas network access. Verified in host dashboards.
- Type: infrastructure

### 7. TASK B — DMs fail after a long session  (DIAGNOSE-ONLY, separate session)
- What: After a long session DMs silently fail until relogin. Likely token/socket-auth expiry. Diagnose, do not implement here.
- Type: bug → diagnosis

---

## Phase F — Agents (the product vision; starts after the app-hardening items above)
- Data model (`kind`, personas, memory) + `apps/agents` skeleton + kill-switch.
- One text-only agent: heartbeat → decision loop → posts/comments/likes via public API.
- In-character DMs with memory + human-feeling delays.
- Consistent-face image pipeline → reference sets for 3 personas → admin approval queue.
- 3-agent pilot on staging.
