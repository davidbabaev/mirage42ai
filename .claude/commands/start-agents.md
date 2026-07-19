---
description: Bring up the local agent stack in order — mongod, API on 8181, then the agents worker
allowed-tools: Bash, Read, BashOutput, KillShell
---

Bring up the full local agent stack, in order, on this machine. Every step is
idempotent: if something is already up and healthy, adopt it instead of starting
a second copy. The database is already seeded — **never** run a seed script.

Run all commands from the repo root with the Bash tool.

## Step 1 — mongod (systemd service `mongod`, port 27017)

mongod runs as a **systemd service**, not an ad-hoc foreground process. It is
configured by `/etc/mongod-mirage42.conf` via a drop-in override at
`/etc/systemd/system/mongod.service.d/mirage42.conf`, which makes it run as user
`david` with:

- dbPath `/home/david/mirage42-localdb` — the seeded data
- log `/home/david/mirage42-logs/mongod.log` — readable without sudo

Never start mongod by hand with `mongod --dbpath ... --fork`. A hand-started
instance defaults to `/var/lib/mongodb`, which is **empty**, and the app then
comes up against an empty database that looks healthy but has no users.

Check the data, not just the port — an answering mongod on the wrong dbpath is
the exact failure this step exists to catch:

```bash
mongosh --quiet --eval 'db.getSiblingDB("mirage42").users.countDocuments({})' 2>/dev/null
```

- Prints `9` (or more) → mongod is up on the seeded data. Go to Step 2.
- Prints `0` → mongod is running on the **wrong dbpath**. Do NOT seed. Show me
  `systemctl show mongod -p ExecStart --no-pager` and stop.
- Errors / no output → the service is down. Check it:

```bash
systemctl is-active mongod
```

  If it is not active, starting it needs **sudo**, which I cannot run. Ask me to
  run this and wait for me to confirm:

```bash
sudo systemctl start mongod
```

Then poll for readiness up to ~30s:

```bash
for i in $(seq 1 30); do
  mongosh --quiet --eval 'db.getSiblingDB("mirage42").users.countDocuments({})' 2>/dev/null | grep -qE '^[1-9]' && echo MONGO_READY && break
  sleep 1
done
```

If it never prints `MONGO_READY`, show the tail of
`/home/david/mirage42-logs/mongod.log` and stop.

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

If a worker is already running, don't start a second one. The worker's argv is
`node src/index.js` (npm sets the workspace via cwd, so the path does **not**
appear in the process line — matching on `apps/agents` finds nothing even when
the worker is up):

```bash
ps -eo pid,args --no-headers | grep '[i]ndex.js'
```

Report the existing PID and stop there.

Otherwise start it detached. Plain `&` or `nohup` is not enough — the worker is
killed when the launching shell exits, and the only symptom is a log that ends
cleanly at "listening for DMs" with no error. Use `setsid`:

```bash
mkdir -p ~/.mirage42-logs
setsid nohup npm run dev --workspace apps/agents \
  > ~/.mirage42-logs/agents.log 2>&1 < /dev/null &
```

Then **verify it survived from a separate command invocation**, not the one that
launched it:

```bash
sleep 5; ps -eo pid,args --no-headers | grep '[i]ndex.js' || echo WORKER_DIED
```

Surface the first output of `~/.mirage42-logs/agents.log` so I can see it
connect. Expect `agents: online`, an authenticated agent, and
`agents: heartbeat started`.

## Finally

Print a short status summary — one line per component:

```
mongod   : active (systemd, dbpath ~/mirage42-localdb, N users)
api      : listening on :8181 (started | adopted)
agents   : running (pid NNNN) — tail ~/.mirage42-logs/agents.log
```

Report the **user count** for mongod, not just "up" — that is what distinguishes
the seeded database from an empty one. Include PIDs and log paths so I can tail
them, and remind me how to stop each component.
