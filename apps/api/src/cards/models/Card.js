const mongoose = require('mongoose');
const {URL} = require('../helpers/validators')

const Comments = new mongoose.Schema({
    // commentId: '', <- mongoDb automatically created this
    userId: mongoose.Schema.Types.ObjectId,
    commentText: {
        type: String,
        maxLength: 1024
    },
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
    isBanned: {
        type: Boolean,
        default: false
    },
})

const Card = mongoose.model('Card', CardSchema)
module.exports = Card;