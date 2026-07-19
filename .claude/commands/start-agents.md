---
description: Bring up the local agent stack in order — mongod, API on 8181, then the agents worker
allowed-tools: Bash, Read, BashOutput, KillShell
---

Bring up the full local agent stack, in order, on this machine. Every step is
idempotent: if something is already up and healthy, adopt it instead of starting
a second copy. The database is already seeded — **never** run a seed script.

Run all commands from the repo root with the Bash tool.

## Step 1 — mongod (port 27017, dbpath `~/mirage42-localdb`)

Check first:

```bash
mongosh --quiet --eval 'db.runCommand({ping:1}).ok' "mongodb://localhost:27017/mirage42" 2>/dev/null
```

- Prints `1` → mongod is already up. Say so and go to Step 2.
- Otherwise, check whether *something else* holds the port:

```bash
(command -v lsof >/dev/null && lsof -nP -iTCP:27017 -sTCP:LISTEN) || ss -lptn 'sport = :27017'
```

  - Port is **free** → start it:

    ```bash
    mkdir -p ~/mirage42-localdb ~/.mirage42-logs
    mongod --dbpath ~/mirage42-localdb --port 27017 \
      --logpath ~/.mirage42-logs/mongod.log --logRotate reopen --fork
    ```

    If `--fork` is unsupported, start it with `run_in_background` instead.
  - Port is **occupied but not answering the ping** → do NOT kill it. Report the
    owning process (name + PID) and stop. Ask me how to proceed.

Then wait for readiness — poll the ping up to ~30s, then fail loudly:

```bash
for i in $(seq 1 30); do
  mongosh --quiet --eval 'db.runCommand({ping:1}).ok' "mongodb://localhost:27017/mirage42" 2>/dev/null | grep -q 1 && echo MONGO_READY && break
  sleep 1
done
```

If it never prints `MONGO_READY`, show the tail of `~/.mirage42-logs/mongod.log` and stop.

## Step 2 — API on port 8181

Check first:

```bash
curl -sf -o /dev/null -w '%{http_code}' http://localhost:8181/ && echo " API_UP"
```

Any HTTP response (even 404) means something is listening.

- Already responding → confirm it's our API (hit a known route or check the
  process on 8181). If it is, adopt it and go to Step 3. If the port is held by
  an unrelated process, report the PID and stop — don't kill it.
- Not responding → make sure `apps/api/.env` exists (if missing, tell me and
  stop; do not invent secrets), then start it in the background:

```bash
npm run dev --workspace apps/api
```

Use `run_in_background: true` so I can keep watching it.

Wait until it is genuinely listening — poll up to ~60s:

```bash
for i in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:8181/ 2>/dev/null && echo API_READY && break
  curl -s -o /dev/null http://localhost:8181/ 2>/dev/null && echo API_READY && break
  sleep 1
done
```

If it never becomes ready, read the background shell's output, show me the
actual error, and stop. Do not continue to Step 3 with a dead API.

## Step 3 — agents worker

Only after Steps 1 and 2 are confirmed green.

The worker exits immediately unless `AGENTS_ENABLED` is truthy. Check
`apps/agents/.env` (or the root `.env`) for `AGENTS_ENABLED`; if it is unset or
false, tell me — set it in the env file rather than hardcoding it in the command.

If a worker is already running, don't start a second one:

```bash
pgrep -af 'apps/agents/src/index.js'
```

Report the existing PID and stop there.

Otherwise start it in the background so I can watch it:

```bash
npm run dev --workspace apps/agents
```

Use `run_in_background: true`, then surface its first output to me so I can see
it connect. Leave it running.

## Finally

Print a short status summary — one line per component:

```
mongod   : started (pid NNNN) | already running
api      : listening on :8181 (started | adopted)
agents   : running (bash id X) — watch with BashOutput
```

Include the background shell IDs for the API and worker so I can tail them, and
remind me how to stop them.
