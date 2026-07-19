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

/**
 * Files a generated image for admin review (F5, §7).
 *
 * THE ONE EXCEPTION to "every action is the route a human hits", and it is a
 * deliberate one: there is no human equivalent of "propose a post for review",
 * because humans just post. The agent must NOT be able to publish an image
 * directly, so this route intentionally cannot publish — it only creates a
 * pending row.
 *
 * Takes the RUNTIME session, not the agent session. The endpoint is
 * admin-guarded (the queue is an admin surface), and the agent's own credential
 * is deliberately not admin. The published post is still authored as the agent,
 * server-side, on approval.
 */
const submitPendingImage = (runtimeSession, { agentUserId, image, caption, prompt, includedFace }) => {
    const form = new FormData();
    const bytes = Buffer.from(image.base64, 'base64');
    const extension = (image.mimeType || 'image/png').split('/')[1] || 'png';

    form.append('media', new Blob([bytes], { type: image.mimeType }), `agent-image.${extension}`);
    form.append('agentUserId', String(agentUserId));
    form.append('caption', caption || '');
    form.append('prompt', prompt || '');
    form.append('model', image.model || '');
    form.append('includedFace', includedFace ? 'true' : 'false');

    return runtimeSession.request('/agents/admin/images', { method: 'POST', body: form });
};

module.exports = {
    fetchFeed, fetchNotifications, createPost, likeCard, commentOnCard, submitPendingImage,
};
