#!/usr/bin/env python3
"""Block git commits that would expose secrets.

Runs as a Claude Code PreToolUse hook on the Bash tool. The harness pipes the
tool input as JSON on stdin. If the proposed command is a `git commit`, we
inspect the staged diff for:

  1. Real .env files (e.g. apps/api/.env, .env.local). .env.example is fine.
  2. High-confidence secret patterns in staged additions (AWS keys, PEM
     private keys, Mongo URIs with embedded credentials, long values assigned
     to "secret"/"token"/"password"/"api_key"/"client_secret" keys, JWTs).

When anything matches, we exit 2 with a clear message on stderr. The Claude
Code harness treats exit code 2 from a PreToolUse hook as "block this tool
call and show stderr to Claude" — so the commit never runs and Claude sees
what was caught.

We deliberately bias toward false positives: better to interrupt and let the
user confirm than to push a key to a public repo. For commands that aren't
`git commit`, we exit 0 immediately so the harness adds zero overhead to
unrelated tool calls.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys


# Matches `git commit` as a word so `git status`, `git committed-something`,
# or `gh pr` don't accidentally trigger.
_COMMIT_RE = re.compile(r"(^|[\s&;|()])git\s+commit(\s|$)")

# Matches `.env`, `.env.local`, `.env.production`, `apps/api/.env`, etc.
# `.env.example` is excluded separately (it's allowed).
_REAL_ENV_RE = re.compile(r"(^|/)\.env(?:\.[^/]+)?$")

# Each entry is (label, compiled pattern). Order matters only for the label
# attached to a finding — the first matching pattern wins per line.
_SECRET_PATTERNS: list[tuple[str, "re.Pattern[str]"]] = [
    ("aws-access-key-id",
     re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("pem-private-key",
     re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("mongodb-uri-with-credentials",
     re.compile(r"mongodb(?:\+srv)?://[^\s/@]+:[^\s/@]+@", re.IGNORECASE)),
    # KEY=value or KEY: value where the value is 16+ url-safe-ish chars.
    # Catches things like `JWT_SECRET=2atzOvI...` and `apiKey: "AbC..."`.
    # The leading and trailing \w* allow the keyword to be embedded in a longer
    # identifier (e.g. SECRET inside JWT_SECRET, where the `_` is a word char so
    # \b alone wouldn't see a boundary).
    ("named-secret-assignment",
     re.compile(
         r"\b\w*(?:api[_-]?key|secret|token|password|passwd|client[_-]?secret)\w*"
         r"\s*[:=]\s*[\"']?[A-Za-z0-9+/=_\-]{16,}",
         re.IGNORECASE,
     )),
    # JWT shape: three base64url segments separated by dots, starting with eyJ.
    ("jwt-token",
     re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")),
]


def _git(args: list[str]) -> str:
    """Run a git command and return stdout. Returns '' on error."""
    result = subprocess.run(
        ["git", *args],
        check=False,
        capture_output=True,
        text=True,
    )
    return result.stdout


def _looks_like_git_commit(command: str) -> bool:
    return bool(_COMMIT_RE.search(command))


def _check_staged(staged_paths: list[str]) -> list[str]:
    """Return a list of human-readable violation messages, empty if clean."""
    violations: list[str] = []

    # Rule 1: real .env files.
    real_env = [
        path for path in staged_paths
        if _REAL_ENV_RE.search(path) and not path.endswith(".env.example")
    ]
    if real_env:
        violations.append(
            "Real .env file(s) staged:\n  " + "\n  ".join(real_env)
        )

    # Rule 2: secret-pattern scan of additions in the staged diff.
    # Exclude .env.example so its placeholder values (e.g. `your_secret_here`)
    # don't trip the named-secret-assignment pattern.
    diff_text = _git([
        "diff", "--cached", "-U0", "--diff-filter=ACMRT",
        "--", ".", ":(exclude)*.env.example",
    ])
    hits: list[str] = []
    for line in diff_text.splitlines():
        # Only look at additions; skip the `+++` file headers.
        if not line.startswith("+") or line.startswith("+++"):
            continue
        body = line[1:]
        for label, pattern in _SECRET_PATTERNS:
            if pattern.search(body):
                # Truncate so a giant added line doesn't flood stderr.
                snippet = body.strip()[:120]
                hits.append(f"  [{label}] {snippet}")
                break
    if hits:
        violations.append("Secret-like content in staged diff:\n" + "\n".join(hits))

    return violations


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        # Malformed input — don't get in the user's way.
        return 0

    command = (payload.get("tool_input") or {}).get("command", "") or ""
    if not _looks_like_git_commit(command):
        return 0

    staged_paths = [p for p in _git(["diff", "--cached", "--name-only"]).splitlines() if p]
    if not staged_paths:
        # Nothing staged — let git itself complain (or it's an --allow-empty).
        return 0

    violations = _check_staged(staged_paths)
    if not violations:
        return 0

    print("BLOCKED: this commit looks like it would expose secrets.\n", file=sys.stderr)
    for v in violations:
        print(v, file=sys.stderr)
        print("", file=sys.stderr)
    print(
        "If this is a false positive, surface what was caught to the user and "
        "wait for confirmation before retrying.",
        file=sys.stderr,
    )
    return 2  # PreToolUse exit-2 contract: block the tool call.


if __name__ == "__main__":
    sys.exit(main())
