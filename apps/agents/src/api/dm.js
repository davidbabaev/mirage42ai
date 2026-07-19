/**
 * Everything the DM path reads, expressed as calls to the API.
 *
 * The thread comes from the same GET /messages/:id the web client paginates;
 * memory comes from the admin runtime endpoints. No database access anywhere.
 */

/** How much of the thread is worth spending prompt tokens on. */
const THREAD_LIMIT = 12;

/**
 * The recent thread plus the counterpart's display name.
 *
 * The name comes from GET /chats (which embeds `otherUser` per row) rather than
 * a separate user fetch — one call the runtime is already entitled to make,
 * instead of two.
 */
const fetchThread = async (session, { conversationId, counterpartId }) => {
    const body = await session.request(
        `/messages/${encodeURIComponent(conversationId)}?limit=${THREAD_LIMIT}`
    );
    // The API returns oldest-first within the page, which is the order the
    // model should read them in.
    const messages = body?.messages || [];

    let counterpartName = 'they';
    try {
        const chats = await session.request('/chats?limit=50');
        const row = (chats?.conversations || []).find(
            (c) => String(c.otherUser?._id) === String(counterpartId)
        );
        if (row?.otherUser) {
            counterpartName = [row.otherUser.name, row.otherUser.lastName]
                .filter(Boolean).join(' ').trim() || 'they';
        }
    } catch {
        // A missing display name is cosmetic — never fail a reply over it.
    }

    return { messages, counterpartName };
};

/** Loads memory over the admin runtime endpoint and trims it for the prompt. */
const loadMemory = async (session, agentUserId, counterpartId) => {
    const body = await session.request(
        `/agents/admin/${encodeURIComponent(agentUserId)}/memory`
    );
    const events = (body?.events || []).slice(-10);
    const facts = (body?.facts || [])
        .filter((f) => String(f.userId) === String(counterpartId))
        .slice(-5);
    return { events, facts };
};

/** Appends to memory over the admin runtime endpoint. */
const writeMemory = (session, agentUserId, { events = [], facts = [] }) =>
    session.request(`/agents/admin/${encodeURIComponent(agentUserId)}/memory`, {
        method: 'POST',
        body: { events, facts },
    });

/** Marks a conversation read, so the unread badge reflects that she saw it. */
const markRead = (session, conversationId) =>
    session.request(`/chats/${encodeURIComponent(conversationId)}/read`, { method: 'PATCH' });

module.exports = { fetchThread, loadMemory, writeMemory, markRead, THREAD_LIMIT };
