const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    actionType: {
      type: String  
    },
    fromUser: mongoose.Schema.Types.ObjectId, // who did the action
    toUser: mongoose.Schema.Types.ObjectId, // who should SEE the notification
    createdAt:{
        type: Date,
        default: Date.now
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    whichCard: mongoose.Schema.Types.ObjectId,
    // Set on comment-like / comment-reply notifications so the client can
    // scroll to and highlight the specific comment the action was about.
    commentId: mongoose.Schema.Types.ObjectId,
})

// Supports the keyset pagination query: filter by recipient, sort newest-first
// on (createdAt, _id). Keeps the notifications list off a collection scan.
NotificationSchema.index({ toUser: 1, createdAt: -1, _id: -1 });

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;