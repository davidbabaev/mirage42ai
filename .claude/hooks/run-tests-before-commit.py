#!/usr/bin/env python3
"""Run both workspaces' test suites before a git commit.

Claude Code PreToolUse hook on the Bash tool. Intercepts `git commit` and runs
the backend (apps/api) and frontend (apps/web) Vitest suites. If either fails,
the commit is blocked with a tail of the failing output so we never save a
broken checkpoint. If both pass, exits 0 and the commit proceeds.

For non-commit Bash commands we exit 0 immediately so the harness sees zero
overhead. Composes cleanly with .claude/hooks/block-secret-commits.py: that
hook is declared first in settings.json so secrets get caught by a cheap
check before we spend ~4 seconds running tests.

We always run both suites rather than guessing which is "affected" — the
total runtime is small and the simpler script is more robust.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys


# Match `git commit` as a word so `git status`, `gh pr ...` etc. don't trigger.
_COMMIT_RE = re.compile(r"(^|[\s&;|()])git\s+commit(\s|$)")

# (npm workspace name, human-readable label for failure output)
_WORKSPACES: list[tuple[str, str]] = [
    ("nodejsexpressmongooseprojectfirst", "apps/api"),
    ("social-media-project",              "apps/web"),
]


def _looks_like_git_commit(command: str) -> bool:
    return bool(_COMMIT_RE.search(command))


def _run_tests(workspace: str) -> tuple[bool, str]:
    """Run `npm test -w <workspace>` and capture combined stdout+stderr."""
    result = subprocess.run(
        ["npm", "test", "--workspace=" + workspace],
        check=False,
        capture_output=True,
        text=True,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    return result.returncode == 0, combined


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        # Malformed input — don't get in the user's way.
        return 0

    command = (payload.get("tool_input") or {}).get("command", "") or ""
    if not _looks_like_git_commit(command):
        return 0

    # Anchor to the repo root so `npm test --workspace=...` resolves correctly.
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    os.chdir(project_dir)

    # If there's nothing staged we leave it to git itself to complain.
    staged = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        capture_output=True, text=True, check=False,
    ).stdout.strip()
    if not staged:
        return 0

    failures: list[tuple[str, str]] = []
    for ws_name, ws_label in _WORKSPACES:
        ok, output = _run_tests(ws_name)
        if not ok:
            failures.append((ws_label, output))

    if failures:
        print(
            "BLOCKED: tests failed; refusing to commit a broken checkpoint.\n",
            file=sys.stderr,
        )
        for label, output in failures:
            print(f"--- {label} test suite (failed) ---", file=sys.stderr)
            # Tail keeps the message readable when vitest dumps a long log.
            tail = output.splitlines()[-40:]
            print("\n".join(tail), file=sys.stderr)
            print("", file=sys.stderr)
        return 2  # PreToolUse exit-2 contract: block this tool call.

    return 0


if __name__ == "__main__":
    sys.exit(main())
