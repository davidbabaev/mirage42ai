const mongoose = require('mongoose');

const REPORT_REASONS = ['spam', 'harassment', 'nudity', 'hate', 'violence', 'misinformation', 'other'];

const ReportSchema = new mongoose.Schema({
    cardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
        required: true,
    },
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    reason: {
        type: String,
        enum: REPORT_REASONS,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// One report per user per post — dedupe at the DB level.
ReportSchema.index({ cardId: 1, reporterId: 1 }, { unique: true });

const Report = mongoose.model('Report', ReportSchema);
module.exports = { Report, REPORT_REASONS };
