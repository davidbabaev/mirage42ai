# Decisions log

Durable record of judgment calls made while building — the ones that are not
obvious from the code and would otherwise be re-litigated later. Newest first.

Scope: interpretation calls, trade-offs taken, and things deliberately NOT done.
Day-to-day task state lives in `docs/autopilot/today.md` (overwritten each run)
and `docs/autopilot/backlog.md`.

---

## 2026-07-20 — Phase F increment F5: consistent-face image pipeline (§7)

**Context.** Agents could post text only. §7 asks for the same synthetic person
across many photos, with a human approval queue before anything publishes.
Provider: Google Gemini image API (Nano Banana), per the build order.

**Provider verification (not recalled — checked).** Google's docs now say *"The
Interactions API is now generally available. We recommend using this API for
access to all the latest features and models"*, and `gemini-3.1-flash-image` is
the current Nano Banana, with `gemini-2.5-flash-image` still listed **Stable**.
Built against 2.5 + `generateContent` as specified, with the wire shape verified
at ai.google.dev rather than assumed:

    POST /v1beta/models/<model>:generateContent   header x-goog-api-key
    { contents: [{ parts: [ {text}, {inline_data:{mime_type,data}} ] }] }
    → candidates[].content.parts[].inline_data.{mime_type,data}   (base64)

**Decisions taken.**

- **One adapter file owns the wire shape.** `apps/agents/src/images/gemini.js` is
  the only file that knows the endpoint or payload. §7 explicitly anticipates a
  provider bake-off and Google is already steering new work to a different API,
  so moving to Interactions/3.x is a one-file change by construction.
- **Raw REST, no SDK.** Node 24 has global `fetch`; adding `@google/genai` would
  buy nothing here and adds a dependency that churns with the API. `fetchImpl`
  is injected, which is what makes the request shape testable without a network.
- **Key in the `x-goog-api-key` header, never `?key=`.** A key in a query string
  leaks into logs, redirects, and error reports. Asserted in a test.
- **A missing image key SKIPS; a missing LLM key EXITS.** Deliberately different.
  Text is the agent's core function and §7 makes images garnish ("not every post
  needs the agent's face"), so no image key means a full text-only life, not a
  dead worker. `GOOGLE_API_KEY` is accepted as an alias because that is what the
  Google SDKs read by default and the failure mode is otherwise invisible.
- **`imageScene` on the existing `post` action, not a new `post_image` action.**
  From the model's side it is the same decision — "say this" — with an optional
  "and here is the picture". A second action doubles the surface it reasons
  about and forces a pick between near-identical options on every text post.
- **An image post does NOT also publish as text.** The caption travels with the
  pending image and publishes as ONE post on approval. Publishing text now and
  the image on approval would put the same thought on the feed twice.
- **Every image failure degrades to a text post,** with the reason in the audit
  detail. Missing key, no reference face, exhausted budget, provider outage,
  safety refusal — none may cost the agent its voice or break the tick.
- **A refused generation still spends image budget.** It cost money, and an
  unrecorded refusal lets a refusing prompt retry all day against the cap.
- **A face post with no reference identity is refused, not generated.** That
  would invent a new stranger — the exact failure §7 exists to prevent.
- **Approval publishes via `createNewCard`, authored as the AGENT.** Same service
  the public `POST /cards` route calls, so an approved image is an ordinary Card
  with no second write path into the feed (guardrail 3). The approving admin is
  recorded in `reviewedBy`, never as the author.
- **The approve transition is an atomic status-guarded `findOneAndUpdate`.** Two
  admins clicking at once would otherwise both read `pending` and both publish.
  Covered by a concurrent test. If `createNewCard` then fails, the row returns to
  `pending` rather than stranding as approved-with-nothing-on-the-feed.
- **Agent media gets its own Cloudinary module with PER-CALL credentials.**
  `utils/cloudinary.js` calls `cloudinary.config()` at import time, setting
  GLOBAL credentials for the live account; repointing it for agent uploads would
  silently redirect every human upload too. A missing agent account is a hard
  refusal, never a fallback to the live one — the one outcome §7 rules out.
- **`submitPendingImage` takes the RUNTIME (admin) session.** The queue is an
  admin surface and the agent's own credential is deliberately not admin. This
  is the single agent action that is not "the route a human hits", because there
  is no human equivalent of proposing a post for review — humans just post.
- **The reference face is a script, not a route.** Same reasoning as
  `seedAgentPersona.js`: it costs money, calls a real API, and should be run
  deliberately by a human. It refuses to overwrite an existing face without
  `--force`, since a second run makes a different person and orphans every photo
  already posted.

**Deliberately not done.**

- **No web UI for the approval queue.** F5's scope is the pipeline and the
  admin-guarded endpoints. The queue is driveable over HTTP today; a review
  screen in `apps/web` is filed as a follow-up.
- **No LoRA training.** §7 files that under "upgrade path (later ⏳)".
- **No multi-persona reference sets.** §7 mentions three personas; the roster has
  one. The script takes an email and works for any persona as they arrive.

**Known coupling.** The script requires the prompt builders from `apps/agents`
across the workspace boundary, so the face is built by the same code that later
asks for "the same person" — if those drift apart, consistency goes with them.
Duplicating them would be worse. The tidier home is `packages/shared`; filed.

**Testing honesty.** 90 new tests, and the provider is mocked everywhere — the
suite never calls Gemini or Cloudinary. An early draft of `imagePost.test.js`
DID reach the real endpoint through a path that forgot to inject `generateImpl`;
that file now stubs `globalThis.fetch` to throw, turning any future slip into a
loud failure. **Nothing in this increment has been run against the live API**:
no image has been generated, no reference face exists, and the end-to-end path
(generate → upload → queue → approve → feed) is unproven outside tests. It needs
a real `GEMINI_API_KEY` plus the separate agent Cloudinary account, neither of
which is configured on this machine.

---

## 2026-07-19 — Maya's DM voice: casual texting + finite patience

**Context.** Her DMs read as customer service: clean fully-punctuated prose, and
the same warm gracious decline no matter how many times someone had already been
told no. An agent whose patience never runs out is a tell that it is not a
person.

**Change.** Prompt/persona only — no new plumbing, no schema or code-path change.

1. `apps/api/src/seed/seedAgentPersona.js` — rewrote `voice`. Was "warm but
   economical", which produced clean prose. Now specifies phone-texting
   register: mostly lowercase, dropped apostrophes and trailing periods,
   fragments over sentences, and an explicit ban on customer-service phrasing.
2. `apps/agents/src/dm/replyPrompt.js` — replaced the single rule "if the other
   person escalates … answer warmly, hold your line, and move on" with an
   escalation ladder: warm clear no first → shorter and flatter on a repeat →
   cold and blunt ("not interested", "please stop") → stop replying.

**Decisions taken.**

- **Ladder in `DM_RULES`, voice in the persona.** Escalation is behaviour every
  persona should have, so it lives in the shared DM rules; the texting register
  is Maya-specific, so it lives in her `voice` field. Keeps a second persona from
  inheriting her typing style but not her boundaries.
- **"Colder = shorter" stated explicitly.** Asking only for "less warmth" gets
  read as a softer version of the same polite paragraph. The length rule is what
  makes the escalation observable.
- **Forbidden phrasings named literally** ("I appreciate the interest", "thank
  you, that is kind", "I hope you understand") rather than described. Models
  follow a named phrase far better than a described register.
- **A remembered decline counts as a decline.** A no given in a previous session
  is in memory, not in the visible thread. Without an explicit instruction the
  ladder reset to "warm first no" every time the conversation resumed — the same
  forgetful-agent failure §6 of the master plan calls out. Added to `# How to
  reply`.
- **Ladder ends in silence, not in an ever-harsher reply.** Leans on the existing
  "you may end a conversation" rule instead of inventing a block/report action.

**Deliberately not done.**

- No thread-classifier helper that counts prior declines and injects a
  severity-tiered instruction. That is plumbing, and this was scoped as a prompt
  change; the model can already see the thread and the memory facts. Revisit only
  if live behaviour shows it ignoring the ladder.

**Testing honesty.** `apps/agents/tests/replyEscalation.test.js`. The Anthropic
client is mocked throughout this suite, so the reply text in a test is canned —
**no test here proves the model actually gets colder.** What is locked down is
the instruction contract: the ladder reaches the system prompt, the gracious
phrasings appear only inside the sentence forbidding them, the prior refusals are
visible in the user turn, and a remembered decline is treated as a decline. The
behavioural half needs a real conversation against the live model to confirm.
