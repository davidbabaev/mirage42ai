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

    // A post shared into the chat. Denormalized snapshot built SERVER-SIDE from
    // the card (never trusting client-supplied preview data) so the bubble can
    // render a rich, clickable card without an extra fetch per message. cardId
    // is the live target — clicking the card opens that post.
    sharedCard: {
        cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
        title: String,
        snippet: String,
        mediaUrl: String,
        mediaType: { type: String, enum: ['image', 'video'] },
        // For video posts: a still poster frame (image URL) derived from a
        // Cloudinary video, so the chat card and external OG image have a real
        // thumbnail. Null for non-Cloudinary videos (the card shows a first-frame
        // <video> fallback instead).
        posterUrl: String,
        authorName: String,
        authorAvatar: String,
    },

}, {timestamps: true});

// Keyset pagination of a conversation's messages sorts by (createdAt desc, _id
// desc) within a conversationId. This compound index serves both the filter and
// the sort so paging a busy thread is an index scan, not a collection scan.
MessageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });

const Message = mongoose.model('Message', MessageSchema);
module.exports = Message;