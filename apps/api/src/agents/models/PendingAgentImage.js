const mongoose = require('mongoose');

/**
 * The human-review queue for agent-generated images (F5, §7).
 *
 * §7: "human-review queue in the pilot: generated images land in a small admin
 * approval list before publishing, so one bad hand doesn't break the illusion."
 *
 * This model IS that gate. A generated image is not a post — it is a proposal
 * for one. Nothing here is visible to any user, on any feed, until an admin
 * approves it and it becomes a real Card. The `status` field is the whole point
 * of the collection: `pending` is inert.
 *
 * The prompt and model are stored alongside the image on purpose. When a face
 * drifts or a generation goes wrong, the first question is always "what did we
 * actually ask for?" — and without the prompt that is unanswerable after the
 * fact.
 */

const STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};

const PendingAgentImageSchema = new mongoose.Schema({
    // The agent this image belongs to and will be published AS. Not the admin.
    agentUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
    },

    // Cloudinary URL in the SEPARATE agent account (§7). The bytes never live
    // in mongo — this collection stays small enough to list cheaply.
    imageUrl: {
        type: String,
        required: true,
        maxLength: 512,
        trim: true,
    },

    // The post text this image would publish with. Written by the agent in the
    // same decision that asked for the image, so the pair is reviewed together
    // rather than an admin approving a picture with unknown wording attached.
    caption: {
        type: String,
        default: '',
        maxLength: 4096,
    },

    // Forensics for a bad generation: exactly what was asked, and of which model.
    prompt: {
        type: String,
        maxLength: 8192,
    },
    model: {
        type: String,
        maxLength: 128,
        trim: true,
    },
    // Whether the agent's own face was requested. §7 allows faceless posts, and
    // a face drift only matters for the ones that asked for a face.
    includedFace: {
        type: Boolean,
        default: true,
    },

    // ---- The gate -----------------------------------------------------
    status: {
        type: String,
        enum: Object.values(STATUS),
        default: STATUS.PENDING,
        required: true,
        index: true,
    },
    // Set on approve/reject so a queue entry is never ambiguous about who acted.
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
    },
    reviewedAt: {
        type: Date,
    },
    // Optional, for rejections — cheap signal about what the pipeline gets wrong.
    reviewNote: {
        type: String,
        maxLength: 1024,
    },
    // The Card an approval produced. Its presence is the proof that this image
    // published exactly once; the approve path checks it before creating another.
    publishedCardId: {
        type: mongoose.Schema.Types.ObjectId,
    },

    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

// The queue is read one way in practice: oldest pending first, for one agent or
// for all of them.
PendingAgentImageSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('PendingAgentImage', PendingAgentImageSchema);
module.exports.STATUS = STATUS;
