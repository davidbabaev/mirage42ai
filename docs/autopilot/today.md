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

### 4. Retire global load-everything providers  [DEFERRED — large migration, needs its own order]
- What: Remove `getAllUsers`/`getAllCards` mount-time full-collection loads (counts are now server-side); anything still depending on them migrates to scoped/paginated queries.
- Done when: no provider loads a full collection on mount; suite green.
- Type: logic
- 2026-07-11 run decision: NOT force-built. Assessed as a LARGE migration (~14 coupled blockers across ~20 components, several needing NEW server endpoints — embed liker/sender/participant/creator sub-objects, postsCount, activate GET /cards/:id, analytics endpoints). It's the read-side half of master-plan #15/#16 and is coupled to the deferred React Query adoption. Can't ship as one clean, green, verified increment without destabilizing the three features shipped this run (chat + admin pagination, optimistic like). Full blocker list + migration plan recorded in backlog.md under the "Infinite scroll" epic. Schedule as its own order, ideally WITH #15, server-embedding sub-objects endpoint-by-endpoint (not big-bang).

### 5. Folder / naming sweep  [DEFERRED — precondition not met]
- What: One restructure — misspellings, casing, "reusable components" naming. Done LAST, after the architecture settles.
- Type: logic
- 2026-07-11 run decision: NOT built. Its own spec says do this LAST, "after the architecture settles." The architecture has NOT settled — provider retirement (#4) and the React Query migration (#15) are still pending. Doing the rename sweep now would just churn files that #4/#15 will move/restructure anyway. Correct to defer until after #4/#15 land.

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
