/**
 * The catch-up pass for DMs that arrived while the worker was down.
 *
 * Live delivery is a socket event: if nobody is listening when it fires, the
 * message is simply never seen. Before this, a restart silently dropped every
 * pending conversation — the person who messaged got nothing, forever, with no
 * error anywhere. (Flagged in the F4 close-out as "no unread sweep on startup".)
 *
 * ONE reply per conversation, not one per missed message: the messages are fed
 * through the same dmQueue the live path uses, so a conversation holding six
 * unread lines still produces a single answer.
 *
 * SAFETY — why marking read is not optional here. `unreadCount` is derived
 * server-side from `lastReadAt`, so a sweep that replies without moving that
 * pointer finds the SAME conversations unread on the next boot and answers them
 * again. Every restart would re-reply to everything. replyToDm marks read after
 * a successful send, which is what makes this pass idempotent.
 */

/** Never walk an unbounded conversation list on boot. */
const MAX_PAGES = 10;
const PAGE_SIZE = 50;

/**
 * @param {object}   opts
 * @param {object}   opts.session      the agent's OWN session — /chats is an
 *                                     ordinary user route and unread is per-user.
 * @param {string}   opts.agentUserId
 * @param {Function} opts.onConversation  (triggerMessage) => void — normally
 *                                        dmQueue.enqueue.
 * @returns {Promise<{conversations: number, messages: number}>}
 */
const sweepUnread = async ({
    session,
    agentUserId,
    onConversation,
    maxPages = MAX_PAGES,
    logger = console,
} = {}) => {
    let cursor = null;
    let pages = 0;
    let conversations = 0;
    let messages = 0;

    do {
        const qs = `limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        let body;
        try {
            body = await session.request(`/chats?${qs}`);
        } catch (err) {
            // A failed sweep must never stop the worker from coming up — live
            // delivery still works, and the next restart tries again.
            logger.error?.(`agents: unread sweep failed — ${err.message}`);
            break;
        }

        for (const row of body?.conversations || []) {
            const unread = Number(row?.unreadCount) || 0;
            if (unread <= 0) continue;

            const counterpartId = row?.otherUser?._id;
            if (!counterpartId) continue;                    // nothing to reply to

            // Defensive: unreadCount counts messages we did NOT send, so a
            // conversation whose last message is ours should never be unread.
            // If it somehow is, answering our own message is the worst outcome.
            if (String(row?.lastMessage?.senderId || '') === String(agentUserId)) continue;

            // A synthetic trigger. replyToDm re-fetches the real thread, so
            // this only has to carry the routing fields; the text is included
            // so a log line reads sensibly.
            onConversation({
                _id: `sweep-${row._id}`,
                conversationId: row._id,
                userId: counterpartId,
                text: row?.lastMessage?.text || '',
                fromSweep: true,
            });

            conversations += 1;
            messages += unread;
        }

        cursor = body?.nextCursor || null;
        pages += 1;
    } while (cursor && pages < maxPages);

    if (cursor && pages >= maxPages) {
        // Never let a bounded scan look like a complete one.
        logger.error?.(
            `agents: unread sweep stopped at ${maxPages} pages with more conversations left`
        );
    }

    return { conversations, messages };
};

module.exports = { sweepUnread, MAX_PAGES, PAGE_SIZE };
