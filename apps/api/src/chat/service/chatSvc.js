const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const {createError} = require('../../utils/handleErrors');
const { default: mongoose } = require('mongoose');

const getOrCreateConversation = async (fromUserId, toUserId) => {

    if(fromUserId.toString() === toUserId.toString()){
        throw createError(400, 'cannot start a conversation with yourself');
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
        let newMessage = new Message({...message, userId})
        newMessage = await newMessage.save();

        // Bump updatedAt and refresh the denormalized lastMessage snapshot so
        // the conversation list can show a real preview without per-row queries.
        await Conversation.findByIdAndUpdate(
            message.conversationId,
            {
                lastMessage: {
                    text: newMessage.text,
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
    deleteChat
}
