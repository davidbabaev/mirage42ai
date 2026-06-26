You are running in autopilot mode. Your task list is in docs/autopilot/today.md.

Before starting any task, set up a safe workspace:

0. Prepare a dedicated branch:
   a. Run `git status` and `git branch --show-current`.
   b. If there are uncommitted changes to tracked files OUTSIDE docs/autopilot/, STOP and report them — do not proceed. (I may have unsaved work that must not be swept into this run.)
   c. Create and switch to a new branch off the current branch, named `autopilot/` followed by today's date (YYYY-MM-DD, from the system date). If that name already exists, append `-2`, `-3`, etc. until it is free.
   d. Confirm you are on the new branch before doing anything else. All work and commits happen here — never on main.

Then work the tasks under "## Tasks" in order, top to bottom. For each task:

1. Do the work described in "What".
2. Check the "Done when" line:
   - If Type is logic → run the test suite. The task passes only if tests are green, including a test that covers this change.
   - If Type is visual:
     a. Ensure the app is running: if http://localhost:5173/ is not already responding, start the dev server with `npm run dev` from the repo root, and wait until http://localhost:5173/ responds before continuing.
     b. Use Playwright to load the affected page at http://localhost:5173/ and take a screenshot at 390px wide and at 1280px wide.
     c. The task passes only if the screenshots show the "Done when" is actually met.
     d. If you started the dev server yourself in step a, stop it once the screenshots are taken.
3. If the check passes → commit just that task's changes with a clear message, then move to the next task.
4. If the check fails → make ONE fix attempt, then re-check. If it still fails, STOP. Do not start the next task. Leave a short note of what failed and what you tried.

Hard rules:
- Work only on the autopilot branch you created in step 0. Never commit to main.
- Never edit docs/master-plan.md.
- Commit after each passing task. Do not batch multiple tasks into one commit.
- Do not push; leave the branch local for me to review.
- If anything is ambiguous or a task is unclear, STOP and leave a note rather than guessing.

When the run ends (list finished, or stopped on a failure), report: which branch you worked on, which tasks passed and committed, and anything that stopped you.
