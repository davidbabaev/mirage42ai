# Autopilot — Deploy Playbook

Follow this to ship a release to production (Render API + Vercel web). It exists
so a deploy is ONE instruction, not a back-and-forth. Hosts:

- **Render (API):** https://mirage42ai.onrender.com  — Node/Express + Socket.io.
- **Vercel (web):** https://mirage42ai-web.vercel.app — Vite SPA (static build).

Both auto-deploy from `main` on push. The agent prepares and verifies; a human
sets dashboard secrets and does the push. Each step is tagged **[HUMAN]** (only a
person with dashboard/push access can do it) or **[AGENT]** (automatable here).

---

## 0. Golden rules (read first)

- **Env vars first, always.** Several prod vars are *fail-loud*: `validateEnv()`
  runs at boot and `process.exit(1)` if a prod-required var is missing — the API
  won't start. So env vars MUST be set in the dashboards BEFORE the deploy that
  needs them. Never push code that needs a var that isn't set yet.
- **`VITE_*` is build-time.** Vite inlines `import.meta.env.VITE_*` at build. A
  change only takes effect on the NEXT Vercel build — set it, then trigger a
  redeploy. It is NOT a runtime variable.
- **No trailing slashes** on any URL var. They're interpolated as
  `${CLIENT_URL}/allcards…` and `${VITE_API_URL}/s/card/…`; a trailing `/`
  produces `//allcards` / `//s/card`.
- **`NODE_ENV=production` on Render** is what flips Secure cookies, prod CORS, and
  the env validation. If it's unset, you silently get dev behavior in prod.

---

## 1. Pre-deploy env audit  **[AGENT]**

Re-run the audit each release (new code may add a var):

```
# API server vars
grep -rohE "process\.env\.[A-Z_]+" apps/api/src --include=*.js | sort -u
# Web build vars
grep -rohE "import\.meta\.env\.[A-Z_]+" apps/web/src --include=*.{js,jsx} | sort -u
# Hardcoded origins / localhost (should only be the documented dev/prod constants)
grep -rnE "localhost|http://|https://" apps/api/src apps/web/src --include=*.{js,jsx} \
  | grep -iE "origin|client_url|server_url|vercel|onrender|localhost"
```

Required-var matrix (verified against the codebase — keep in sync):

| Var | Host | Required? | Production value |
|-----|------|-----------|------------------|
| `NODE_ENV` | Render API | **prod-critical** | `production` |
| `DB_CONNECTION_STRING` | Render API | **required** | Atlas SRV URI (the app reads THIS, not `ATLAS_CONNECTION_STRING`) |
| `JWT_SECRET` | Render API | **required** | long random secret (do not reuse dev) |
| `CLIENT_URL` | Render API | **prod-required** (fail-loud) | `https://mirage42ai-web.vercel.app` |
| `ALLOWED_ORIGINS` | Render API | **prod-required** (fail-loud) | `https://mirage42ai-web.vercel.app` (comma-sep to add more; the canonical origin is also baked in) |
| `CLOUDINARY_CLOUD_NAME` | Render API | **prod-required** (fail-loud) | from Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Render API | **prod-required** (fail-loud) | from Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Render API | **prod-required** (fail-loud) | from Cloudinary dashboard |
| `SERVER_URL` | Render API | needed for Google OAuth | `https://mirage42ai.onrender.com` |
| `GOOGLE_CLIENT_ID` | Render API | optional (OAuth) | from Google console (+ add the prod callback URL there) |
| `GOOGLE_CLIENT_SECRET` | Render API | optional (OAuth) | from Google console |
| `ACCESS_TOKEN_TTL` | Render API | optional | unset → `15m` |
| `REFRESH_TOKEN_TTL_MS` | Render API | optional | unset → 7 days |
| `PORT` | Render API | optional | Render injects it; leave unset |
| `VITE_API_URL` | Vercel web | **required (build-time)** | `https://mirage42ai.onrender.com` |

Output this table (with any NEW vars flagged) so the human knows exactly what to
set before touching the dashboards.

---

## 2. Env-var rules  **[AGENT verifies, HUMAN sets]**

1. No trailing slashes (see Golden rules).
2. `VITE_API_URL` must be set in Vercel's **build** env and a redeploy triggered;
   changing it without rebuilding does nothing.
3. Fail-loud vars (`CLIENT_URL`, `ALLOWED_ORIGINS`, `CLOUDINARY_*` in production)
   mean a missing var crashes boot — so **set every required var before the push
   that needs it**. This ordering is mandatory, not advisory.
4. Secrets never go in git — only in the dashboards / `.env` (untracked).
   `.env.example` documents the names only.

---

## 3. CORS + cookie standing checklist  **[AGENT verifies]**

Cross-site auth (SPA on Vercel ↔ API on Render are different sites) only works if
ALL of these hold:

- [ ] Production web origin is in the API allowlist — `getAllowedOrigins()` bakes
      in `PROD_ORIGIN`; confirm it equals the live Vercel origin (and add any
      extra origins via `ALLOWED_ORIGINS`).
- [ ] HTTP CORS: `origin: getAllowedOrigins()` (a specific list, never `*`) +
      `credentials: true` (`middlewares/cors.js`).
- [ ] Socket.io CORS uses the same `getAllowedOrigins()` (no credentials — JWT in
      the handshake).
- [ ] Refresh cookie is `HttpOnly; Secure; SameSite=None` in prod
      (`auth/refreshTokens.js` `cookieOptions()`), so it survives cross-site —
      requires HTTPS on both hosts (Render + Vercel are HTTPS).
- [ ] SPA sends `credentials: 'include'` on every request (`apiService.js`).
- [ ] Helmet allows cross-origin reads (`crossOriginResourcePolicy: cross-origin`).

This is exercised by `apps/api/tests/refresh-cross-site.test.js` (production-mode
cookie + read-back) and `allowed-origins.test.js`. Run the API suite to confirm.

---

## 4. Deploy order

1. **[HUMAN]** Set/verify ALL env vars from the §1 matrix in the Render and Vercel
   dashboards. Render API + Vercel web. (Do this FIRST — fail-loud vars.)
2. **[AGENT]** Make any required config/code changes on a branch (e.g. a new
   allowed origin, a new env var) and merge to `main` locally via
   `merge-instruction.md`. Run the full suite — must be green.
3. **[AGENT]** Final pre-push check: `npm run test -w apps/api` and
   `npm run test -w apps/web` both green; `git log origin/main..main` shows the
   intended commits and nothing stray.
4. **[HUMAN]** `git push origin main`. Render and Vercel both auto-build and
   deploy from `main`. (Vercel rebuilds the SPA, picking up `VITE_*` changes.)
5. **[AGENT]** Watch both dashboards for a green build; if the API build crashes
   at boot with `FATAL: Missing required environment variable(s): …`, a §1 var is
   missing — go back to step 1.

---

## 5. Post-deploy verification  **[AGENT]**

1. API is up:
   `curl -s -o /dev/null -w "%{http_code}\n" https://mirage42ai.onrender.com/cards`
2. OG route serves real, ABSOLUTE, PUBLIC URLs (no localhost) — test an image AND
   a video post:
   ```
   curl -s https://mirage42ai.onrender.com/s/card/<imageCardId> \
     | grep -E 'og:title|og:image|og:url|twitter:card|location.replace'
   curl -s https://mirage42ai.onrender.com/s/card/<videoCardId> | grep og:image
   ```
   Confirm: `og:url` points at `https://mirage42ai-web.vercel.app/allcards?card=…`,
   `og:image` is an absolute `https://…` (Cloudinary `c_fill` for images / `so_0`
   poster for videos), and the redirect targets the Vercel SPA — none are
   `localhost`.
3. **[HUMAN/AGENT]** Validate the rich preview with a sharing debugger (crawlers
   can't reach localhost, so this is the real external gate):
   - Facebook/OG: https://developers.facebook.com/tools/debug/
   - LinkedIn: https://www.linkedin.com/post-inspector/
   - X/Twitter card validator (or paste into a DM and check the unfurl).
4. Cross-site auth smoke (in a browser on the live SPA): log in, hard-refresh,
   confirm you stay logged in (the `SameSite=None; Secure` refresh cookie round-
   trips). DevTools → Application → Cookies → `refresh-token` shows `Secure` +
   `SameSite=None`.

---

## 6. Human-only vs agent-automated — quick reference

| Step | Who |
|------|-----|
| Env audit + required-var table (§1) | **AGENT** |
| Verify env-var rules / CORS-cookie checklist (§2, §3) | **AGENT** |
| Set secrets in Render/Vercel dashboards (§4.1) | **HUMAN** |
| Config/code changes + local merge (§4.2) | **AGENT** |
| Pre-push test + log check (§4.3) | **AGENT** |
| `git push origin main` (§4.4) | **HUMAN** |
| Curl OG route + assert absolute URLs (§5.1–5.2) | **AGENT** |
| Sharing-debugger validation (§5.3) | **HUMAN** (external sites) |
| Live cross-site auth smoke (§5.4) | **HUMAN** (real browser session) |

The agent never sets dashboard secrets and never pushes `main`. The human does
those two things; everything else can be prepared and verified automatically.
