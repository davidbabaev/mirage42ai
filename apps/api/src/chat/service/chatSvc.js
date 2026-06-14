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
                }
            },
            {timestamps: true} // force updatedAt to refresh
        )
        return newMessage;
    }
    catch(err){
        throw err;
    }
}

const getMessages = async (conversationId) => {
    const messages = await Message.find({conversationId}).sort({createdAt: 1})
    // smae as: { conversationId: conversationId }
    return messages;
}

const getChats = async (userId) => {
    const chats = await Conversation.find({
        $or: [
            {fromUser: new mongoose.Types.ObjectId(userId)},
            {toUser: new mongoose.Types.ObjectId(userId)}
        ]
    }).sort({updatedAt: -1});

    // Attach this user's unread count to each conversation: messages newer than
    // their lastReadAt that they didn't send.
    // SCALING NOTE: this runs one countDocuments per conversation (N+1). Fine for
    // the per-user conversation counts we expect; if a user accumulates many
    // hundreds of conversations, replace this loop with a single aggregation
    // ($lookup messages + $group, or a $facet) to compute all counts in one query.
    const enriched = await Promise.all(chats.map(async (chat) => {
        const lastRead = chat.lastReadAt?.get(String(userId));
        const unreadFilter = {
            conversationId: chat._id,
            userId: { $ne: new mongoose.Types.ObjectId(userId) },
        };
        if (lastRead) unreadFilter.createdAt = { $gt: lastRead };
        const unreadCount = await Message.countDocuments(unreadFilter);

        return { ...chat.toObject(), unreadCount };
    }));

    return enriched;
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

const deleteChat = async (deleterUserId, conversationId) => {
    const conversation = await Conversation.findById(conversationId);
    if(!conversation) throw createError(404, 'Conversation not found');
    
    if(!(conversation.fromUser.toString() === deleterUserId || 
        conversation.toUser.toString() === deleterUserId)
    ){
        throw createError(403, 'Not allowed to delete this conversation')
    }
    
    await Message.deleteMany({conversationId: conversationId})
    await Conversation.findByIdAndDelete(conversationId)
    return conversation;
}

module.exports = {
    getOrCreateConversation,
    createNewMessage,
    getMessages,
    getChats,
    markConversationRead,
    deleteChat
}
