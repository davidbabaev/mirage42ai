const Card = require('../models/Card');
const { Report, REPORT_REASONS } = require('../models/Report');
const User = require('../../users/models/User');
const Notification = require('../../notifications/models/Notifications');
const { createError } = require('../../utils/handleErrors');
const { getHiddenUserIds } = require('./cardsSvc');

// POST /cards/:id/report
// - Validates reason against the allowlist.
// - 403 when reporting own post.
// - 404 when the card is invisible (banned/deleted or blocked-either-way).
// - Deduped at DB level (unique index); duplicate returns { alreadyReported: true }
//   with HTTP 200 (idempotent success — reporter already did their job).
// - On a NEW report: increments Card.reportCount and fan-outs an admin notification
//   to every isAdmin user via a single insertMany (no per-row save).
const reportCard = async (cardId, reporterId, reason) => {
    if (!REPORT_REASONS.includes(reason)) {
        throw createError(400, `Invalid reason. Allowed values: ${REPORT_REASONS.join(', ')}`);
    }

    // Visibility check mirrors getPublicCard: banned/deleted → 404, blocked → 404.
    const card = await Card.findById(cardId);
    if (!card) throw createError(404, 'Card not found');
    if (card.status !== 'active') throw createError(404, 'Card not found');

    if (String(card.userId) === String(reporterId)) {
        throw createError(403, 'Cannot report your own post');
    }

    const hidden = await getHiddenUserIds(reporterId);
    if (hidden.has(String(card.userId))) throw createError(404, 'Card not found');

    // Attempt insert; catch duplicate key to dedupe.
    try {
        await Report.create({ cardId, reporterId, reason });
    } catch (err) {
        if (err.code === 11000) {
            return { alreadyReported: true };
        }
        throw err;
    }

    // Increment the denormalized counter on the card.
    await Card.updateOne({ _id: cardId }, { $inc: { reportCount: 1 } });

    // Fan out admin notifications in one bulk write (no N+1 loop-saves).
    // fromUser = reporter so admins can click through; GET /cards/:id/reports
    // also exposes reporter identity to admins, so this is consistent.
    const admins = await User.find({ isAdmin: true }, '_id').lean();
    if (admins.length > 0) {
        const notifDocs = admins.map(admin => ({
            actionType: 'post-reported',
            fromUser: reporterId,
            toUser: admin._id,
            whichCard: cardId,
        }));
        await Notification.insertMany(notifDocs);
    }

    return { alreadyReported: false };
};

// GET /cards/:id/reports — admin-only.
// Returns reporter identity (name, lastName, avatar, _id) + reason + timestamp.
// Single populate call — no N+1.
const getCardReports = async (cardId) => {
    const reports = await Report.find({ cardId })
        .populate('reporterId', 'name lastName profilePicture _id')
        .sort({ createdAt: -1 })
        .lean();

    return reports.map(r => ({
        _id: r._id,
        reason: r.reason,
        createdAt: r.createdAt,
        reporter: r.reporterId
            ? {
                _id: r.reporterId._id,
                name: r.reporterId.name,
                lastName: r.reporterId.lastName,
                profilePicture: r.reporterId.profilePicture,
              }
            : null,
    }));
};

module.exports = { reportCard, getCardReports, REPORT_REASONS };
