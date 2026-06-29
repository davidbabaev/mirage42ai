const mongoose = require('mongoose');
const {URL} = require('../helpers/validators')

// A single-level reply to a comment (Instagram/YouTube style — replies are not
// themselves repliable). MongoDB auto-creates an _id on each subdocument.
const Reply = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    replyText: {
        type: String,
        maxLength: 1024
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
})

const Comments = new mongoose.Schema({
    // commentId: '', <- mongoDb automatically created this
    userId: mongoose.Schema.Types.ObjectId,
    commentText: {
        type: String,
        maxLength: 1024
    },
    // userIds who liked this comment — same shape as Card.likes ([String]).
    likes: [String],
    // single-level replies under this comment
    replies: [Reply],
    createdAt: {
        type: Date,
        default: Date.now
    },
})

const CardSchema = new mongoose.Schema({
    title: String,
    content: String,
    web: URL,
    mediaUrl: URL,
    mediaType: {
        type: String,
        enum: ['image', 'video']
    },
    location: {
        type: String,
        trim: true,
        maxLength: 256
    },
    category: String,
    likes: [String],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    comments: [Comments],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'banned', 'deleted'],
        default: 'active'
    },
    // Denormalized counter incremented on each new (non-duplicate) report.
    // Kept on the card for fast admin-table queries without an aggregate.
    reportCount: {
        type: Number,
        default: 0,
    },
})

const Card = mongoose.model('Card', CardSchema)
module.exports = Card;