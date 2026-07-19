const { z } = require('zod');

/**
 * The one thing an agent decides per heartbeat.
 *
 * A discriminated union rather than a bag of optional fields: "comment with no
 * text" and "post with a cardId" are then unrepresentable rather than merely
 * discouraged. The model is constrained to this shape server-side via
 * structured outputs, AND the response is re-validated here — the schema
 * constrains generation, the parse guarantees what we act on.
 */

// Long enough for a real post, short enough that a runaway generation is
// obvious rather than expensive.
const MAX_POST = 1000;
const MAX_COMMENT = 300;

const DoNothing = z.object({
    action: z.literal('do_nothing'),
    // Why nothing happened is the single most useful line in the audit trail
    // when tuning a persona — without it every quiet tick looks identical.
    reason: z.string().max(300).optional(),
});

const Like = z.object({
    action: z.literal('like'),
    cardId: z.string().min(1),
    reason: z.string().max(300).optional(),
});

const Comment = z.object({
    action: z.literal('comment'),
    cardId: z.string().min(1),
    text: z.string().min(1).max(MAX_COMMENT),
    reason: z.string().max(300).optional(),
});

const Post = z.object({
    action: z.literal('post'),
    text: z.string().min(3).max(MAX_POST),
    reason: z.string().max(300).optional(),
});

const AgentDecision = z.discriminatedUnion('action', [DoNothing, Like, Comment, Post]);

const ACTIONS = ['do_nothing', 'like', 'comment', 'post'];

/**
 * JSON Schema for the Anthropic structured-outputs `output_config.format`.
 *
 * Hand-written rather than generated from the zod schema: the API's structured
 * outputs support a restricted JSON Schema subset (no recursion, no string
 * length constraints), so a generated schema can carry keywords the API
 * rejects. Keeping the two side by side in one file makes the pairing obvious
 * and is covered by a test that they agree on the action set.
 */
const DECISION_JSON_SCHEMA = {
    type: 'object',
    properties: {
        action: { type: 'string', enum: ACTIONS },
        cardId: {
            type: 'string',
            description: 'The _id of the post being liked or commented on. Required for like and comment; omit otherwise.',
        },
        text: {
            type: 'string',
            description: 'The comment body, or the text of a new post. Required for comment and post; omit otherwise.',
        },
        reason: {
            type: 'string',
            description: 'One short sentence on why, for the audit trail. Always include it.',
        },
    },
    required: ['action'],
    additionalProperties: false,
};

/**
 * Validates a raw decision object.
 *
 * Returns the parsed decision, or a do_nothing fallback carrying the error.
 * NEVER throws: a malformed decision must never be able to cause an action, and
 * it must never crash the worker either. Refusing to act on a response we do
 * not understand is the safe default.
 */
const parseDecision = (raw) => {
    const result = AgentDecision.safeParse(raw);
    if (result.success) return { ok: true, decision: result.data };

    return {
        ok: false,
        error: result.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
        decision: { action: 'do_nothing', reason: 'malformed decision from the model' },
    };
};

module.exports = { AgentDecision, DECISION_JSON_SCHEMA, parseDecision, ACTIONS, MAX_POST, MAX_COMMENT };
