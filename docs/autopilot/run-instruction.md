You are running in autopilot mode. Your task list is in docs/autopilot/today.md.

Before starting any task, set up a safe workspace:

0. Prepare a dedicated branch:
   a. Run `git status` and `git branch --show-current`.
   b. If there are uncommitted changes to tracked files OUTSIDE docs/autopilot/, STOP and report them — do not proceed. (I may have unsaved work that must not be swept into this run.)
   c. Create and switch to a new branch off the current branch, named `autopilot/` followed by today's date (YYYY-MM-DD, from the system date). If that name already exists, append `-2`, `-3`, etc. until it is free.
   d. Confirm you are on the new branch before doing anything else. All work and commits happen here — never on main.

Then work the tasks under "## Tasks" in order, top to bottom. For each task:

1. Diagnose first (read-only). Before changing anything, investigate the root cause of the task using search/explore subagents: find the relevant file(s) and WHY the current behavior is wrong. Do not edit during this step. If the root cause or approach is unclear, choose the most reasonable option that fits CLAUDE.md and the existing codebase patterns, record that choice in the final report, and proceed — do not stop to ask. Otherwise proceed to implement the fix based on what you found.
2. Do the work described in "What".
3. Check the "Done when" line:
   - Lint gate (MANDATORY — all task types): run `npm run lint` and it MUST pass
     CLEAN with zero errors before a task can be marked done. CI runs the same
     lint and a lint failure BLOCKS deploys, so a task with a failing (or newly
     dirtied) lint is NOT done — fix it before proceeding.
   - If Type is logic → run the test suite. The task passes only if tests are green, including a test that covers this change.
   - If Type is visual:
     a. Ensure the app is running: if http://localhost:5173/ is not already responding, start the dev server with `npm run dev` from the repo root, and wait until http://localhost:5173/ responds before continuing.
     b. Use Playwright to load the affected page at http://localhost:5173/ and take a screenshot at 390px wide and at 1280px wide.
     c. The task passes only if the screenshots show the "Done when" is actually met.
     d. If you started the dev server yourself in step a, stop it once the screenshots are taken.
4. If the check passes → commit just that task's changes with a clear message, then move to the next task.
4b. MANDATORY CLOSE-OUT — the moment a task is committed, update the tracking files, in the SAME commit or immediately after. A task is NOT "done" until docs/autopilot/backlog.md reflects it; a committed task still sitting under "## Active" is a FAILURE, not a partial success.
    - Remove that task's block from docs/autopilot/today.md (it's finished).
    - In docs/autopilot/backlog.md, move the matching item OUT of "## Active". Because the branch is committed but not yet merged, move it to "## Awaiting review" and add: "Built on branch <branch-name>, commit <short-sha> — awaiting review/merge." (It moves on to "## Done" at merge time — see merge-instruction.md.) Never leave a committed task under "## Active".
    - Include these edits in the same task commit or a follow-up commit — never skip them, and never start the next task while the previous one is still stale under "## Active".
5. If the check fails → make ONE fix attempt, then re-check. If it still fails, STOP. Do not start the next task. Leave a short note of what failed and what you tried.

Hard rules:
- Work only on the autopilot branch you created in step 0. Never commit to main.
- Never edit docs/master-plan.md.
- Each commit contains one task's code changes plus the bookkeeping edits to docs/autopilot/today.md and docs/autopilot/backlog.md for that same task. Never combine TWO tasks' code changes into one commit.
- A committed task that is still sitting under "## Active" in docs/autopilot/backlog.md is a FAILURE. The close-out in step 4b is mandatory: backlog.md must reflect every committed task before you move on.
- A task with a failing `npm run lint` is NOT done. Lint must be clean locally before commit; CI lint failures block deploys.
- Do not push; leave the branch local for me to review.
- When a decision is ambiguous, decide it yourself using CLAUDE.md and existing codebase conventions as your guide, log the decision and your reasoning in the report, and continue. Only STOP for: a failing check you cannot fix in one attempt, a destructive/irreversible action, or a task that is technically impossible as written. Never stop merely because a choice is open — make it and record it.
- Maintain a DECISIONS LOG in the final report: every judgment call made during the run, with one line of reasoning each, so the human can review all choices at merge time.

When the run ends (list finished, or stopped on a failure), report: which branch you worked on, which tasks passed and committed, and anything that stopped you.

## Decision authority (default: decide and continue)

You have full authority to make product, design, and architectural decisions
on the autopilot branch without asking David. The branch is quarantined and
David reviews every decision at the merge gate — that review IS the approval.
Do not use guardrails as a reason to stop mid-run.

Resolve every fork yourself, in this order:
1. If master-plan.md states a direction, that IS the decision. Take the
   smallest incremental step toward it. Do not ask.
2. If master-plan is silent, follow the convention a top production app in
   this category (Instagram / LinkedIn / WhatsApp) would use.
3. If both are silent, pick the most reversible option that keeps the diff
   reviewable.

Record every non-trivial decision in the decisions log (what you chose, the
alternatives, one line of why). Logging REPLACES asking — it's how David vetoes
at review instead of blocking you mid-run.

Never present a numbered menu of options for anything rules 1–3 already answer.
If you're about to ask "which approach should I take," you already have the
answer above. Pick it and continue.

## Guardrail 7 (rescoped) — the ONLY things you stop and ask about

Stop and ask David ONLY before an action git cannot undo:
- deleting or mutating production data (Atlas), or a destructive prod migration
- deleting Cloudinary assets
- changing production env vars, DNS / Cloudflare, or Render / Vercel settings
- force-pushing, or anything touching `main`
- editing master-plan.md (never touch it)

Large or structural CODE changes are NOT a reason to stop. They live on the
quarantined branch and are caught at review. Decide, log, continue.

## Starting a run — do NOT clean the tree

Never stop because the working tree is dirty at the start of a run. A dirty
tree is just the starting point, not a problem to fix.

To begin, branch off the current state exactly as it is:

    git checkout -b autopilot/YYYY-MM-DD

`checkout -b` carries any uncommitted changes onto the new branch. Nothing is
lost and nothing lands on main. You do NOT need a clean tree first, and you
must NOT try to create one by committing to main or reverting files.

### master-plan.md is radioactive — leave it exactly as-is
If docs/master-plan.md has uncommitted changes, those are David's. Do not
stage it, do not commit it, do not revert it, do not stash it. Ignore its
dirty state completely and never include it in any commit you make. If a
`git add` would ever touch it, exclude it explicitly.

### Your own files
Your bookkeeping and work files (today.md, backlog.md, run-instruction.md, the
decisions log, and all app code) get committed to the autopilot branch as
normal. Commit those freely — they're on the quarantined branch, not main.

There is no pre-run "clear the tree" step. Branch, then work. The only things
that still make you stop are the irreversible actions in Guardrail 7.