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

        // new: bump the parent conversation's updatedAt
        await Conversation.findByIdAndUpdate(
            message.conversationId,
            {}, // not field changes
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
    console.log('getChats called with userId:', userId, typeof userId)
    const chats = await Conversation.find({
        $or: [
            {fromUser: new mongoose.Types.ObjectId(userId)},
            {toUser: new mongoose.Types.ObjectId(userId)}
        ]
    }).sort({updatedAt: -1});
    console.log('getChats found:', chats.length, 'conversations')
    return chats;
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
    deleteChat
}
