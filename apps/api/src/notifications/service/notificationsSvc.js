const Notification = require("../models/Notification");
const User = require('../../users/models/User');
const { createError } = require('../../utils/handleErrors');
const { normalizeLimit, decodeCursor, runKeysetPage } = require('../../utils/cursorPagination');

// Attach the sender user sub-object to each notification so the client renders
// name/avatar without scanning a global users array. One User.find for the whole
// page (no N+1), same manual fetch-and-attach pattern as chatSvc. `fromUser` is
// null for system notifications (e.g. post-removed, moderator hidden) → sender null.
const attachSenders = async (page) => {
    const ids = [...new Set(page.map(n => n.fromUser).filter(Boolean).map(String))];
    const users = ids.length
        ? await User.find({ _id: { $in: ids } }, 'name lastName profilePicture')
        : [];
    const byId = new Map(users.map(u => [String(u._id), u]));
    return page.map(n => {
        const u = n.fromUser ? byId.get(String(n.fromUser)) : null;
        return {
            ...n.toObject(),
            sender: u
                ? { _id: u._id, name: u.name, lastName: u.lastName, profilePicture: u.profilePicture || '' }
                : null,
        };
    });
};

// user's notifications bell — cursor-paginated (keyset on createdAt+_id, newest
// first). Replaces the old hard .limit(50) so older notifications are reachable
// by scrolling. The first page (no cursor) also carries `unreadCount`, computed
// server-side over ALL of the user's rows so the bell badge stays correct no
// matter how far the panel is paginated.
const getNotifications = async (userId, opts = {}) => {
    const pageSize = normalizeLimit(opts.limit, 20, 50);

    let decoded = null;
    if (opts.cursor) {
        decoded = decodeCursor(opts.cursor);
        if (!decoded) throw createError(400, "Invalid notifications cursor");
    }

    const { page, nextCursor } = await runKeysetPage(
        Notification,
        { toUser: userId },
        decoded,
        pageSize,
    );

    // Only the first page needs the badge seed; deeper pages omit it to avoid an
    // extra count query per scroll.
    const unreadCount = decoded
        ? undefined
        : await Notification.countDocuments({ toUser: userId, isRead: false });

    const items = await attachSenders(page);
    return { items, nextCursor, unreadCount };
}

const getNotification = async (notificationId) => {
    const notification = await Notification.findById(notificationId);
    if(!notification) throw createError(404, "Notifications not found")
    return notification;
}

// Mark as read notification
const markAsRead = async (userId) => {
    let notifications = await Notification.updateMany(
        {toUser: userId},
        {$set: {isRead: true}}
    );
    return notifications;
} 

// Delete notification
const deleteNotification = async (notificationId) => {
    const notification = await Notification.findByIdAndDelete(notificationId)
    if(!notification) throw createError(404, "Notifications not found")
    return notification;
}

module.exports = {getNotifications, markAsRead, deleteNotification, getNotification}