---
name: stuck-debugging
description: Use when a bug or feature isn't behaving as expected after one or more failed fix attempts, when the user says something "still isn't working," "isn't fixed," or "you didn't change anything," or when a change passes tests but the user reports the real app looks the same. Activates loop-breaking debugging discipline.
---

# Stuck-debugging playbook

You are likely in a "fix loop": pattern-matching the same wrong area and trying variations that don't work. Break it with this discipline.

## Rule 0 — Never claim a fix works without observing it
A passing jsdom/unit test is NOT proof a runtime or visual behavior is fixed. For any visual, video, animation, or browser-runtime bug, observe the actual behavior in a real browser (Playwright MCP) before saying it's fixed. If you cannot observe it, say so explicitly and ask the user to verify — do not assert success.

## Rule 1 — Two strikes, then diagnose
If a bug has survived two fix attempts, STOP writing fixes. Produce a diagnosis instead:
1. The true root cause you now believe is responsible — name the specific file and line.
2. What you already tried and exactly why each attempt failed.
3. What information you are still missing that would confirm the real cause.
Then propose ONE targeted fix. Do not shotgun multiple changes.

## Rule 2 — Get evidence, don't speculate
Before theorizing, gather real signal:
- If a browser MCP (Playwright) is available, open the running app on localhost, reproduce the bug, read the console, screenshot it, and inspect the relevant element/DOM state.
- Add temporary, targeted console logs at the exact suspected trigger (e.g. inside every play(), every effect that could restart a video) and read what actually fires.
- Confirm the deployed bundle actually contains your latest change before debugging further.

## Rule 3 — Isolate
If still stuck, ignore the rest of the codebase. Identify the single component or function that owns the broken behavior and reason only about that plus its direct collaborators. Remove false leads.

## Rule 4 — Stop and report, don't spiral
Do not burn long autonomous runs guessing. After gathering evidence or making one targeted fix, stop and report: what you observed, what you changed, and how the user can verify in the browser. Keep debugging logs in place until the user confirms with their own eyes.

## Cost discipline
A single visible/runtime bug is usually a 1–2 line fix once the cause is known. Significant effort with no observed progress is the signal to switch to diagnosis (Rule 1) — not to try harder.