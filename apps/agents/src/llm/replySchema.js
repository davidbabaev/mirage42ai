const { z } = require('zod');

/**
 * What the model returns when deciding how to answer a DM.
 *
 * Two fields beyond the reply text, and both earn their place:
 *
 *  reply    — may be EMPTY. Not every message deserves an answer; a real
 *             person lets some conversations end. Forcing a reply would make
 *             the agent the one who always gets the last word, which is its
 *             own tell.
 *  fact     — an optional distilled memory ("David asked me out; I said I'm
 *             married"). Asking for it in the SAME call is deliberate: a
 *             second call to summarise would double the per-DM cost, and §4
 *             budgets a whole day at 20-40 small calls.
 */
const MAX_REPLY = 600;
const MAX_FACT = 300;

const AgentReply = z.object({
    // '' means "say nothing" — a valid, human outcome.
    reply: z.string().max(MAX_REPLY),
    // Only set when something was learned that should outlive the rolling log.
    fact: z.string().max(MAX_FACT).optional().nullable(),
    // One line for the audit trail.
    reason: z.string().max(300).optional().nullable(),
});

/**
 * JSON Schema for output_config.format.
 *
 * Hand-written, and the wire shape is EXACTLY { type, schema } — see the F3
 * incident where an invented `name` field 400d every call. No length
 * constraints here: structured outputs rejects minLength/maxLength, so the
 * bounds live in zod, which validates what comes back.
 */
const REPLY_JSON_SCHEMA = {
    type: 'object',
    properties: {
        reply: {
            type: 'string',
            description: 'What you say back, in your own voice. Empty string if this does not deserve a reply.',
        },
        fact: {
            type: 'string',
            description: 'A one-sentence fact about this person worth remembering long-term, if anything happened worth remembering. Omit otherwise.',
        },
        reason: {
            type: 'string',
            description: 'One short sentence on why you replied this way, for the audit trail.',
        },
    },
    required: ['reply'],
    additionalProperties: false,
};

/**
 * Validates a raw reply. NEVER throws, and on anything malformed returns a
 * SILENT reply rather than a guess — saying nothing is always safe; saying
 * something we did not validate is not.
 */
const parseReply = (raw) => {
    const result = AgentReply.safeParse(raw);
    if (result.success) {
        return { ok: true, reply: result.data };
    }
    return {
        ok: false,
        error: result.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
        reply: { reply: '', fact: null, reason: 'malformed reply from the model' },
    };
};

module.exports = { AgentReply, REPLY_JSON_SCHEMA, parseReply, MAX_REPLY, MAX_FACT };
