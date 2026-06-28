const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../../users/models/User');
const Card = require('../../cards/models/Card');
const {createError} = require('../../utils/handleErrors');
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

// Per-user history: only messages newer than this user's delete cutoff. After
// I delete, my thread is empty until new messages arrive; I never see the old
// history. Passing no userId returns everything (used internally if needed).
const getMessages = async (conversationId, userId) => {
    const filter = { conversationId };
    if (userId) {
        const conversation = await Conversation.findById(conversationId);
        const deletedAt = conversation?.deletedAt?.get(String(userId));
        if (deletedAt) filter.createdAt = { $gt: deletedAt };
    }
    const messages = await Message.find(filter).sort({createdAt: 1})
    return messages;
}

const getChats = async (userId) => {
    const chats = await Conversation.find({
        $or: [
            {fromUser: new mongoose.Types.ObjectId(userId)},
            {toUser: new mongoose.Types.ObjectId(userId)}
        ],
    }).sort({updatedAt: -1});

    // Per conversation: apply this user's delete cutoff, then attach unread count.
    // SCALING NOTE: this runs one or two countDocuments per conversation (N+1).
    // Fine for the per-user conversation counts we expect; if a user accumulates
    // many hundreds of conversations, replace this loop with a single aggregation
    // ($lookup messages + $group, or a $facet) to compute all counts in one query.
    const enriched = await Promise.all(chats.map(async (chat) => {
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
    }));

    return enriched.filter(Boolean);
}

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
    markConversationRead,
    deleteChat,
    buildSharedCardSnapshot,
    cloudinaryVideoPoster,
}
