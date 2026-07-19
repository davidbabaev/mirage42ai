const { DECISION_JSON_SCHEMA, parseDecision } = require('./decisionSchema');

/**
 * The one LLM call per heartbeat (master-plan §6, "Decision loop (per tick)").
 *
 * Deliberately ONE cheap call. §4 budgets an agent's whole day at 20–40 small
 * calls; a decision loop that chains calls would blow that in an afternoon, and
 * cost discipline lives in code rather than intentions (§11).
 *
 * The model is `claude-haiku-4-5` — the Haiku-class model §4 specifies. It also
 * supports structured outputs, so the decision shape is enforced by the API
 * rather than coaxed out of free text and regexed back.
 *
 * No extended thinking: this is a small, cheap judgement call made 20-40 times
 * a day, and thinking tokens would dominate the bill for no benefit.
 */
const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_TOKENS = 1024;

/** Trims a feed page down to what the decision actually needs. */
const summariseFeed = (cards = [], limit = 12) =>
    cards.slice(0, limit).map((card) => ({
        cardId: String(card._id),
        author: [card.creator?.name, card.creator?.lastName].filter(Boolean).join(' ') || 'someone',
        text: String(card.content || '').slice(0, 400),
        likes: Array.isArray(card.likes) ? card.likes.length : 0,
        comments: Array.isArray(card.comments) ? card.comments.length : 0,
        alreadyLikedByMe: Boolean(card.likedByMe),
    }));

const buildUserMessage = ({ feed = [], notifications = [] }) => {
    const lines = [];

    if (feed.length) {
        lines.push('Here is what is in your feed right now:');
        lines.push(JSON.stringify(summariseFeed(feed), null, 2));
    } else {
        lines.push('Your feed is empty right now.');
    }

    if (notifications.length) {
        lines.push('', `You have ${notifications.length} unread notification(s).`);
    }

    lines.push(
        '',
        'Decide what to do. Your options:',
        '- do_nothing  (usually the right answer)',
        '- like        (needs cardId)',
        '- comment     (needs cardId and text)',
        '- post        (needs text; a text-only post, no image)',
        '',
        'Always include a short `reason`.',
    );

    return lines.join('\n');
};

/**
 * Asks the model what to do.
 *
 * `client` is an Anthropic SDK client, injected so tests never touch the real
 * API. Returns { decision, usage, raw } — and NEVER throws for a bad decision:
 * a model that returns nonsense results in do_nothing, because refusing to act
 * on a response we do not understand is the only safe default.
 *
 * A transport failure (network, 429, 500) DOES throw — that is the caller's
 * problem to retry or skip, and swallowing it would hide an outage.
 */
const decide = async ({
    client,
    systemPrompt,
    feed = [],
    notifications = [],
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
} = {}) => {
    if (!client) throw new Error('decide: an Anthropic client is required');
    if (!systemPrompt) throw new Error('decide: systemPrompt is required');

    const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        // Structured outputs. The wire shape is EXACTLY { type, schema } —
        // see JSONOutputFormat in @anthropic-ai/sdk messages.d.ts. It has no
        // `name` field; sending one is rejected with
        //   400 invalid_request_error: output_config.format.name:
        //   Extra inputs are not permitted
        // which is what shipped, because every test mocked the response and a
        // mocked response cannot reject a malformed request. See
        // tests/decideRequestContract.test.js.
        output_config: {
            format: {
                type: 'json_schema',
                schema: DECISION_JSON_SCHEMA,
            },
        },
        messages: [{ role: 'user', content: buildUserMessage({ feed, notifications }) }],
    });

    // A refusal is a valid outcome, not a crash: treat it as do_nothing and
    // record it, so a persona that keeps tripping safety is visible in the log.
    if (response?.stop_reason === 'refusal') {
        return {
            decision: { action: 'do_nothing', reason: 'model refused' },
            usage: response.usage || null,
            raw: null,
            refused: true,
        };
    }

    const textBlock = (response?.content || []).find((b) => b.type === 'text');
    let raw = null;
    try {
        raw = textBlock ? JSON.parse(textBlock.text) : null;
    } catch {
        raw = null;
    }

    const parsed = parseDecision(raw);
    return {
        decision: parsed.decision,
        usage: response?.usage || null,
        raw,
        valid: parsed.ok,
        error: parsed.ok ? null : parsed.error,
    };
};

module.exports = { decide, buildUserMessage, summariseFeed, DEFAULT_MODEL, DEFAULT_MAX_TOKENS };
