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
    whichCard: mongoose.Schema.Types.ObjectId
})

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;