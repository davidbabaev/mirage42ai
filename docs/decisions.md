# Decisions log

Durable record of judgment calls made while building — the ones that are not
obvious from the code and would otherwise be re-litigated later. Newest first.

Scope: interpretation calls, trade-offs taken, and things deliberately NOT done.
Day-to-day task state lives in `docs/autopilot/today.md` (overwritten each run)
and `docs/autopilot/backlog.md`.

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
