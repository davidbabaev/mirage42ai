const mongoose = require('mongoose');

// Denormalized snapshot of the most recent message, so the conversation list
// can render a real preview without an extra query per row.
const LastMessageSchema = new mongoose.Schema({
    text: String,
    mediaType: { type: String, enum: ['image', 'video'] },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: Date,
}, { _id: false });

const ConversationSchema = new mongoose.Schema({
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Per-user read pointer (a conversation always has exactly 2 users).
    // unread(me) = messages in this conversation newer than lastReadAt[me]
    // that I didn't send.
    lastReadAt: {
        type: Map,
        of: Date,
        default: () => new Map(),
    },
    lastMessage: LastMessageSchema,
}, {timestamps: true})

const Conversation = mongoose.model('Conversation', ConversationSchema);
module.exports = Conversation;
