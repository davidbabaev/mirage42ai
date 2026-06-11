const mongoose = require('mongoose');
const { URL } = require('../../cards/helpers/validators');

const MessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
    },
    text:{
        type: String,
        maxLength: 1024
    },
    mediaUrl: URL,
    mediaType: {
        type: String,
        enum: ['image', 'video']
    },

}, {timestamps: true});

const Message = mongoose.model('Message', MessageSchema);
module.exports = Message;