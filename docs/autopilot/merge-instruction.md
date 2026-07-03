# Autopilot — Merge & Close-Out

Follow this when David approves reviewed work. He will name the branch to merge.

1. git checkout main. Confirm a clean working tree — if docs/autopilot task-list files are dirty, commit them first.
2. Confirm the branch's task commits are NOT yet on main (git log --oneline -6).
3. Merge the named branch into main: git merge <branch>.
4. Confirm the task commits are now on main.
5. Run the API test suite: npm run test -w apps/api. If it fails, STOP and report — do not push.
6. MANDATORY CLOSE-OUT — the moment the merge is committed, update docs/autopilot/backlog.md before doing anything else. A task is NOT "done" until backlog.md reflects it; any item still under "## Active" or "## Awaiting review" after its work is merged is a FAILURE. Move every item that was built on this branch down to "## Done", each as a one-line entry that INCLUDES its commit sha and notes it's merged to main (e.g. "Merged to main as <short-sha>"). Leave "## Awaiting review" empty if nothing else remains, and confirm no merged item is left stale under "## Active".
7. Commit the backlog update in the same close-out, immediately after the merge: chore: mark <items> done (merged). Never leave a merged task's backlog entry uncommitted.
8. Delete the merged branch: git branch -d <branch>.
9. Push main.

Report each step. STOP and report if the merge conflicts or tests fail — never force past either.
