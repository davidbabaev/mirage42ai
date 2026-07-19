/**
 * Everything the agent can DO, expressed as calls to the public API.
 *
 * Every function here takes an AgentSession and hits the same route a human's
 * browser hits. There is no agent-only endpoint and no database access — that
 * is the "agents are users" invariant (master-plan §3) made concrete. If a
 * function ever needs a special route, the invariant has been broken.
 */

/** The agent's own feed — the same GET /cards/feed the web app paginates. */
const fetchFeed = (session, { limit = 12 } = {}) =>
    session.request(`/cards/feed?limit=${encodeURIComponent(limit)}`);

/** Unread notifications, first page only — enough to notice being talked to. */
const fetchNotifications = async (session) => {
    const body = await session.request('/notifications?limit=10');
    return body?.items || [];
};

/**
 * Creates a TEXT-ONLY post.
 *
 * The route is multipart because it also accepts media; a text-only post simply
 * attaches no file. That path only exists because POST /cards was fixed earlier
 * in this increment to stop requiring one.
 */
const createPost = (session, text) => {
    const form = new FormData();
    form.append('content', text);
    return session.request('/cards', { method: 'POST', body: form });
};

/**
 * Toggles a like. NOTE: PATCH /cards/:id IS the like toggle — there is no
 * /like segment. Because it TOGGLES, calling it on a post the agent already
 * liked would silently UNLIKE it, so the caller must not re-like.
 */
const likeCard = (session, cardId) =>
    session.request(`/cards/${encodeURIComponent(cardId)}`, { method: 'PATCH' });

/** Adds a comment. */
const commentOnCard = (session, cardId, commentText) =>
    session.request(`/cards/${encodeURIComponent(cardId)}/comments`, {
        method: 'PATCH',
        body: { commentText },
    });

module.exports = { fetchFeed, fetchNotifications, createPost, likeCard, commentOnCard };
