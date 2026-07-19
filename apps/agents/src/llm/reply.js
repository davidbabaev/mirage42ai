const { REPLY_JSON_SCHEMA } = require('./replySchema');
const { DEFAULT_MODEL, DEFAULT_MAX_TOKENS } = require('./decide');

/**
 * The one LLM call that answers a DM.
 *
 * Same model and same cost discipline as the feed decision — one cheap call,
 * no extended thinking. The reply AND the memory fact come back together, so a
 * conversation costs one call rather than two (§4 budgets a whole day at 20-40).
 *
 * The wire shape of output_config.format is EXACTLY { type, schema }. An
 * invented `name` field here 400d every call in F3; the contract test in
 * tests/decideRequestContract.test.js covers the feed path and
 * tests/replyRequestContract.test.js covers this one.
 */
const replyToMessage = async ({
    client,
    systemPrompt,
    userMessage,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
} = {}) => {
    if (!client) throw new Error('replyToMessage: an Anthropic client is required');
    if (!systemPrompt) throw new Error('replyToMessage: systemPrompt is required');
    if (!userMessage) throw new Error('replyToMessage: userMessage is required');

    const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        output_config: {
            format: {
                type: 'json_schema',
                schema: REPLY_JSON_SCHEMA,
            },
        },
        messages: [{ role: 'user', content: userMessage }],
    });

    // A refusal is a valid outcome: say nothing. Recording it means a persona
    // that keeps tripping safety is visible in the log rather than just quiet.
    if (response?.stop_reason === 'refusal') {
        return { raw: { reply: '', reason: 'model refused' }, usage: response.usage || null, refused: true };
    }

    const textBlock = (response?.content || []).find((b) => b.type === 'text');
    let raw = null;
    try {
        raw = textBlock ? JSON.parse(textBlock.text) : null;
    } catch {
        raw = null;
    }

    return { raw, usage: response?.usage || null };
};

module.exports = { replyToMessage };
