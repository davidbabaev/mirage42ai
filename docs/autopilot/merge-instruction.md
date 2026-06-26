# Autopilot — Merge & Close-Out

Follow this when David approves reviewed work. He will name the branch to merge.

1. git checkout main. Confirm a clean working tree — if docs/autopilot task-list files are dirty, commit them first.
2. Confirm the branch's task commits are NOT yet on main (git log --oneline -6).
3. Merge the named branch into main: git merge <branch>.
4. Confirm the task commits are now on main.
5. Run the API test suite: npm run test -w apps/api. If it fails, STOP and report — do not push.
6. In docs/autopilot/backlog.md, move every item currently under "## Awaiting review" that was built on this branch down to "## Done", each as a one-line entry noting it's merged to main. Leave "## Awaiting review" empty if nothing else remains.
7. Commit the backlog update: chore: mark <items> done (merged).
8. Delete the merged branch: git branch -d <branch>.
9. Push main.

Report each step. STOP and report if the merge conflicts or tests fail — never force past either.
