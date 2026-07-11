const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../../users/models/User');
const Card = require('../../cards/models/Card');
const { getHiddenUserIds } = require('../../cards/service/cardsSvc');
const {createError} = require('../../utils/handleErrors');
const { normalizeLimit, decodeCursor, runKeysetPage } = require('../../utils/cursorPagination');
const { default: mongoose } = require('mongoose');

// Derive a still poster (a JPG frame) from a Cloudinary VIDEO url:
//   .../video/upload/<id>.mp4 -> .../video/upload/so_0/<id>.jpg
// so a shared video has a real thumbnail in chat and a valid OG image. Returns
// null for non-Cloudinary videos (e.g. external/seed urls) — the chat card then
// falls back to a muted first-frame <video>, and OG falls back to the banner.
const cloudinaryVideoPoster = (videoUrl) => {
    if (!videoUrl || !/res\.cloudinary\.com/.test(videoUrl)) return null;
    const marker = '/video/upload/';
    const i = videoUrl.indexOf(marker);
    if (i === -1) return null;
    const head = videoUrl.slice(0, i + marker.length);
    let tail = videoUrl.slice(i + marker.length).replace(/\?.*$/, '');
    // swap the video extension for .jpg (or append it if none)
    tail = /\.[a-z0-9]+$/i.test(tail) ? tail.replace(/\.[a-z0-9]+$/i, '.jpg') : `${tail}.jpg`;
    return `${head}so_0/${tail}`;
};

// Build the rich-preview snapshot for a shared post, authoritatively, from the
// card + its author. The client only sends a cardId — everything shown in the
// chat card (title, image, author) is read here so a sender can't spoof it.
const buildSharedCardSnapshot = async (cardId) => {
    if(!mongoose.isValidObjectId(cardId)) throw createError(400, 'Invalid post');
    const card = await Card.findById(cardId);
    if(!card || card.status !== 'active') throw createError(404, 'Post not found');

    const author = await User.findById(card.userId);
    const authorName = author ? `${author.name} ${author.lastName || ''}`.trim() : 'Unknown';

    const snippet = (card.title || card.content || '').slice(0, 140);
    return {
        cardId: card._id,
        title: card.title || '',
        snippet,
        mediaUrl: card.mediaUrl,
        mediaType: card.mediaType,
        posterUrl: card.mediaType === 'video' ? cloudinaryVideoPoster(card.mediaUrl) : undefined,
        authorName,
        authorAvatar: author?.profilePicture || '',
    };
}

const getOrCreateConversation = async (fromUserId, toUserId) => {

    if(fromUserId.toString() === toUserId.toString()){
        throw createError(400, 'cannot start a conversation with yourself');
    }

    // No messaging across a block (either direction).
    const [fromUser, toUser] = await Promise.all([
        User.findById(fromUserId),
        User.findById(toUserId),
    ]);
    if(!fromUser || !toUser) throw createError(404, 'User not found');
    if((fromUser.blocked || []).map(String).includes(String(toUserId)) ||
       (toUser.blocked || []).map(String).includes(String(fromUserId))){
        throw createError(403, 'Cannot message a blocked user');
    }

    const conversation = await Conversation.findOne({
        $or: [
            {fromUser: fromUserId, toUser: toUserId},
            {fromUser: toUserId, toUser: fromUserId},
        ]
    });
    if(!conversation){
        let newConversation = new Conversation({fromUser: fromUserId, toUser: toUserId})
        newConversation = await newConversation.save();
        return newConversation
    }
    return conversation;
}

const createNewMessage = async (message, userId) => {
    try{
        // Whitelist what a client may set on a message — never spread the raw
        // socket payload into the model. A shared post is built server-side from
        // the supplied cardId; `text` (if any) rides along as an optional caption.
        const fields = {
            userId,
            conversationId: message.conversationId,
            text: message.text,
            mediaUrl: message.mediaUrl,
            mediaType: message.mediaType,
        };
        if(message.sharedCardId){
            fields.sharedCard = await buildSharedCardSnapshot(message.sharedCardId);
        }

        let newMessage = new Message(fields)
        newMessage = await newMessage.save();

        // Preview text for the conversation list: caption if present, else a
        // generic label for a shared post, else the message text.
        const previewText = newMessage.text
            || (newMessage.sharedCard?.cardId ? 'Shared a post' : newMessage.text);

        // Bump updatedAt and refresh the denormalized lastMessage snapshot so
        // the conversation list can show a real preview without per-row queries.
        await Conversation.findByIdAndUpdate(
            message.conversationId,
            {
                lastMessage: {
                    text: previewText,
                    mediaType: newMessage.mediaType,
                    senderId: userId,
                    createdAt: newMessage.createdAt,
                },
                // NOTE: we deliberately do NOT touch deletedAt here. A new message
                // (createdAt > deletedAt[me]) naturally resurfaces the chat for a
                // user who had deleted it, while their deletedAt keeps the old
                // history hidden — they only see messages newer than their cutoff.
            },
            {timestamps: true} // force updatedAt to refresh
        )
        return newMessage;
    }
    catch(err){
        throw err;
    }
}

// Per-user history, keyset-paginated newest-first. Returns one page of messages
// in ASCENDING order (oldest-at-top, ready to render) plus `nextCursor` for the
// NEXT-OLDER page — so the chat opens on the most recent messages and scrolling
// up loads older ones. Only messages newer than this user's delete cutoff are
// ever visible (per-side delete); the cutoff and the cursor coexist under $and.
const getMessages = async (conversationId, userId, opts = {}) => {
    const baseFilter = { conversationId };
    if (userId) {
        const conversation = await Conversation.findById(conversationId);
        const deletedAt = conversation?.deletedAt?.get(String(userId));
        if (deletedAt) baseFilter.createdAt = { $gt: deletedAt };
    }

    const limit = normalizeLimit(opts.limit, 25, 50);
    const decoded = decodeCursor(opts.cursor);
    // A non-null cursor that fails to decode is a client bug — fail fast rather
    // than silently serving the latest page as if it were an older one.
    if (opts.cursor && !decoded) throw createError(400, 'Invalid cursor');

    // runKeysetPage sorts (createdAt desc, _id desc), so a page is the batch of
    // messages OLDER than the cursor. Reverse to ascending for display; the
    // cursor it returns points at the oldest message in the page = where the
    // next (older) page continues.
    const { page, nextCursor } = await runKeysetPage(Message, baseFilter, decoded, limit);
    return { messages: page.slice().reverse(), nextCursor };
}

// The set of conversations this user participates in (either side).
const conversationBaseFilter = (userId) => ({
    $or: [
        { fromUser: new mongoose.Types.ObjectId(userId) },
        { toUser: new mongoose.Types.ObjectId(userId) },
    ],
});

// Enrich one conversation for this user: apply the block + per-side-delete
// visibility rules, and attach `unreadCount`. Returns null when the conversation
// should be hidden (blocked counterpart, or the user deleted it and nothing newer
// exists). Single source of truth for both the list rows and the unread total.
// SCALING NOTE: one or two countDocuments per conversation (N+1). Fine for the
// per-user conversation counts we expect; if a user ever accumulates many
// hundreds, replace with a single aggregation ($lookup messages + $group).
const enrichConversation = async (chat, userId, hidden) => {
    const otherId = String(chat.fromUser) === String(userId)
        ? String(chat.toUser) : String(chat.fromUser);
    if (hidden.has(otherId)) return null;

    const deletedAt = chat.deletedAt?.get(String(userId));

    // Per-side delete: if I cleared this chat, hide it until a newer message
    // exists (from either side). The other user's view is unaffected.
    if (deletedAt) {
        const visibleCount = await Message.countDocuments({
            conversationId: chat._id,
            createdAt: { $gt: deletedAt },
        });
        if (visibleCount === 0) return null;
    }

    // Unread = messages I didn't send, newer than the later of my read /
    // delete cutoffs (so old, pre-delete messages never count).
    const lastRead = chat.lastReadAt?.get(String(userId));
    const threshold = [lastRead, deletedAt].filter(Boolean).sort((a, b) => b - a)[0];
    const unreadFilter = {
        conversationId: chat._id,
        userId: { $ne: new mongoose.Types.ObjectId(userId) },
    };
    if (threshold) unreadFilter.createdAt = { $gt: threshold };
    const unreadCount = await Message.countDocuments(unreadFilter);

    return { ...chat.toObject(), unreadCount };
};

// Total unread across ALL of this user's visible conversations. Computed
// server-side so the nav badge stays correct once the conversation LIST is
// paginated (the client only holds page 1, so it can't sum the rest itself).
// Conversation COUNT per user is small, so scanning them all here is cheap even
// though message VOLUME is not — see the SCALING NOTE on enrichConversation.
const getTotalUnread = async (userId, hidden) => {
    const h = hidden || await getHiddenUserIds(userId);
    const chats = await Conversation.find(conversationBaseFilter(userId));
    const enriched = await Promise.all(chats.map((c) => enrichConversation(c, userId, h)));
    return enriched.reduce((sum, c) => sum + (c ? c.unreadCount : 0), 0);
};

// Conversation list, keyset-paginated newest-first by `updatedAt` (the field a
// new message bumps). Returns { conversations, nextCursor }; on the FIRST page
// (no cursor) it also returns `totalUnread` across all conversations so the
// client can seed the nav badge and keep it live via sockets — cursor pages omit
// it (mirrors notifications). Hidden/deleted rows are filtered AFTER the keyset
// page, so a page can hold fewer than `limit` rows while nextCursor still points
// at the correct next-older conversation (same as the feed's block handling).
const getChats = async (userId, opts = {}) => {
    const limit = normalizeLimit(opts.limit, 15, 50);
    const decoded = decodeCursor(opts.cursor);
    // A non-null cursor that fails to decode is a client bug — fail fast.
    if (opts.cursor && !decoded) throw createError(400, 'Invalid cursor');

    const hidden = await getHiddenUserIds(userId);
    const { page, nextCursor } = await runKeysetPage(
        Conversation, conversationBaseFilter(userId), decoded, limit, 'updatedAt'
    );

    const conversations = (await Promise.all(
        page.map((chat) => enrichConversation(chat, userId, hidden))
    )).filter(Boolean);

    const result = { conversations, nextCursor };
    if (!decoded) result.totalUnread = await getTotalUnread(userId, hidden);
    return result;
}

// Recent DM contacts for the share-dialog default list: the other participant
// of each of this user's most-recent conversations, deduped, most-recent first,
// excluding anyone in a block relationship (either direction), capped at `limit`.
const getRecentContacts = async (userId, limit = 10) => {
    const cap = Math.min(Math.max(Number(limit) || 10, 1), 10);
    const convos = await Conversation.find({
        $or: [{ fromUser: userId }, { toUser: userId }],
    }).sort({ updatedAt: -1 });

    const hidden = await getHiddenUserIds(userId);
    const seen = new Set();
    const ordered = [];
    for (const c of convos) {
        const otherId = String(c.fromUser) === String(userId) ? String(c.toUser) : String(c.fromUser);
        if (seen.has(otherId) || hidden.has(otherId)) continue;
        seen.add(otherId);
        ordered.push({ otherId, lastInteractedAt: c.updatedAt });
        if (ordered.length >= cap) break;
    }
    if (!ordered.length) return [];

    const users = await User.find({ _id: { $in: ordered.map(o => o.otherId) } });
    const byId = new Map(users.map(u => [String(u._id), u]));
    // preserve recency order; drop any participant that no longer exists
    return ordered
        .map(o => ({ o, u: byId.get(o.otherId) }))
        .filter(x => x.u)
        .map(({ o, u }) => ({
            _id: u._id,
            name: u.name,
            lastName: u.lastName,
            displayName: `${u.name} ${u.lastName || ''}`.trim(),
            profilePicture: u.profilePicture || '',
            lastInteractedAt: o.lastInteractedAt,
        }));
};

// Mark a conversation read for this user (sets their read pointer to now).
const markConversationRead = async (userId, conversationId) => {
    const conversation = await Conversation.findById(conversationId);
    if(!conversation) throw createError(404, 'Conversation not found');

    const isParticipant =
        conversation.fromUser.toString() === userId ||
        conversation.toUser.toString() === userId;
    if(!isParticipant) throw createError(403, 'Not allowed');

    conversation.lastReadAt.set(String(userId), new Date());
    await conversation.save();
    return conversation;
}

// Per-side delete by timestamp: records the caller's cutoff (deletedAt[me] = now)
// so they stop seeing messages on/before it. When BOTH participants have a cutoff
// and no message is newer than the earlier one, nothing is visible to either side,
// so the conversation + its messages are hard-deleted inline (no separate cleanup
// job for the pilot). Returns the conversation + a hardDeleted flag for the route.
const deleteChat = async (deleterUserId, conversationId) => {
    const conversation = await Conversation.findById(conversationId);
    if(!conversation) throw createError(404, 'Conversation not found');

    const isParticipant =
        conversation.fromUser.toString() === deleterUserId ||
        conversation.toUser.toString() === deleterUserId;
    if(!isParticipant){
        throw createError(403, 'Not allowed to delete this conversation')
    }

    conversation.deletedAt.set(String(deleterUserId), new Date());

    const aCut = conversation.deletedAt.get(String(conversation.fromUser));
    const bCut = conversation.deletedAt.get(String(conversation.toUser));
    if(aCut && bCut){
        const minCut = aCut < bCut ? aCut : bCut;
        const liveCount = await Message.countDocuments({
            conversationId, createdAt: { $gt: minCut },
        });
        if(liveCount === 0){
            await Message.deleteMany({conversationId: conversationId})
            await Conversation.findByIdAndDelete(conversationId)
            return { conversation, hardDeleted: true };
        }
    }

    await conversation.save();
    return { conversation, hardDeleted: false };
}

module.exports = {
    getOrCreateConversation,
    createNewMessage,
    getMessages,
    getChats,
    getTotalUnread,
    markConversationRead,
    deleteChat,
    buildSharedCardSnapshot,
    cloudinaryVideoPoster,
    getRecentContacts,
}
