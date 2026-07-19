const AgentMemory = require('../models/AgentMemory');

/**
 * Reading and writing an agent's memory (master-plan §5).
 *
 * Both arrays are BOUNDED here rather than by a TTL index, because the limit is
 * about prompt size and cost — not age. An unbounded memory would be sent to
 * the model on every call and would grow the bill forever (§4 budgets a whole
 * day at 20-40 small calls).
 *
 * The caps differ on purpose:
 *   events — many, cheap, disposable. Keep a working window of recent activity.
 *   facts  — few, durable, expensive to lose. A distilled fact is the thing
 *            that stops the agent being freshly charmed by the same advance
 *            next week, so it survives far longer than the raw events.
 */
const MAX_EVENTS = 50;
const MAX_FACTS = 200;

/** How many of each to hand the model. Kept small — prompt tokens are the bill. */
const PROMPT_EVENTS = 10;
const PROMPT_FACTS_PER_PERSON = 5;

const loadMemory = async (agentUserId) => {
    const doc = await AgentMemory.findOne({ userId: agentUserId }).lean();
    return doc || { userId: agentUserId, events: [], facts: [] };
};

/**
 * Appends one event, newest LAST, trimming the oldest beyond the cap.
 *
 * `$push` + `$slice: -MAX` does the append and the trim in a single atomic
 * update — read-modify-write would race two ticks against each other and
 * silently drop one agent's memory of what it just did.
 */
const appendEvent = async (agentUserId, { type, withUserId, summary, at }) => {
    if (!type || !summary) throw new Error('appendEvent: type and summary are required');

    await AgentMemory.updateOne(
        { userId: agentUserId },
        {
            $push: {
                events: {
                    $each: [{ type, withUserId, summary, at: at || new Date() }],
                    $slice: -MAX_EVENTS,
                },
            },
            $set: { updatedAt: new Date() },
            $setOnInsert: { userId: agentUserId, createdAt: new Date() },
        },
        { upsert: true }
    );
};

/**
 * Records a distilled fact about a relationship.
 *
 * Facts accumulate rather than overwrite: "David asked me out; I said I'm
 * married" and "David's sister is getting married in June" are both true and
 * both worth keeping. Collapsing them into one slot per person would lose the
 * texture that makes a follow-up conversation land.
 */
const appendFact = async (agentUserId, { userId, fact, at }) => {
    if (!userId || !fact) throw new Error('appendFact: userId and fact are required');

    await AgentMemory.updateOne(
        { userId: agentUserId },
        {
            $push: {
                facts: {
                    $each: [{ userId, fact, at: at || new Date() }],
                    $slice: -MAX_FACTS,
                },
            },
            $set: { updatedAt: new Date() },
            $setOnInsert: { userId: agentUserId, createdAt: new Date() },
        },
        { upsert: true }
    );
};

/**
 * The slice of memory worth spending prompt tokens on for THIS conversation:
 * recent activity generally, plus everything distilled about this one person.
 *
 * Facts about the person are NOT truncated by recency across the whole memory —
 * they are filtered first, then capped. Otherwise a busy week of unrelated
 * events would push "I already turned this person down" out of the prompt,
 * which is precisely the memory that must not be lost.
 */
const memoryForPrompt = (memory, aboutUserId) => {
    const events = (memory.events || []).slice(-PROMPT_EVENTS);

    const facts = aboutUserId
        ? (memory.facts || [])
            .filter((f) => String(f.userId) === String(aboutUserId))
            .slice(-PROMPT_FACTS_PER_PERSON)
        : [];

    return { events, facts };
};

module.exports = {
    loadMemory, appendEvent, appendFact, memoryForPrompt,
    MAX_EVENTS, MAX_FACTS, PROMPT_EVENTS, PROMPT_FACTS_PER_PERSON,
};
