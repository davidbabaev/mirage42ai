const PendingAgentImage = require('../models/PendingAgentImage');
const { STATUS } = require('../models/PendingAgentImage');
const { createNewCard } = require('../../cards/service/cardsSvc');
const { createError } = require('../../utils/handleErrors');
const User = require('../../users/models/User');
const { ACCOUNT_KIND } = require('@mirage42ai/shared');

/**
 * The approval queue's business logic (F5, §7).
 *
 * The single rule this file exists to enforce: an agent-generated image becomes
 * a visible post ONLY through `approvePendingImage`. There is no other path
 * from a generated image to a Card, which is what makes "nothing auto-publishes"
 * a property of the code rather than a convention someone has to remember.
 */

/** Queue submissions are only meaningful for agent accounts. */
const assertAgentAccount = async (userId) => {
    const user = await User.findById(userId, 'kind').lean();
    if (!user) throw createError(404, 'No such user');
    if (user.kind !== ACCOUNT_KIND.AGENT) {
        throw createError(400, 'Only agent accounts can queue images');
    }
};

/**
 * Files a generated image for review. Deliberately returns something inert:
 * the caller gets an id and a status, never anything that looks like a post.
 */
const queuePendingImage = async ({ agentUserId, imageUrl, caption = '', prompt, model, includedFace = true }) => {
    if (!imageUrl) throw createError(400, 'imageUrl is required');
    await assertAgentAccount(agentUserId);

    const doc = await new PendingAgentImage({
        agentUserId, imageUrl, caption, prompt, model, includedFace,
        status: STATUS.PENDING,
    }).save();

    return doc.toObject();
};

/** The admin's list. Oldest first — a review queue is a queue, not a feed. */
const listPendingImages = async ({ status = STATUS.PENDING, agentUserId, limit = 50 } = {}) => {
    const filter = {};
    // 'all' is an explicit escape hatch for reviewing history; anything else is
    // validated against the enum so a typo cannot silently return everything.
    if (status !== 'all') {
        if (!Object.values(STATUS).includes(status)) throw createError(400, 'Unknown status');
        filter.status = status;
    }
    if (agentUserId) filter.agentUserId = agentUserId;

    // Bounded: the queue is admin-facing but still must not load unboundedly.
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);

    return PendingAgentImage.find(filter)
        .sort({ createdAt: 1 })
        .limit(capped)
        .lean();
};

/**
 * Approves one image and publishes it AS THE AGENT.
 *
 * Publishing goes through `createNewCard` — the same service the public
 * POST /cards route calls — so an approved agent image is a completely ordinary
 * Card with no second write path into the feed (guardrail 3: one code path).
 *
 * The status transition is done with an atomic findOneAndUpdate GUARDED ON
 * status: 'pending'. Two admins clicking approve at the same moment would
 * otherwise both read a pending row and both publish, putting the same photo on
 * the feed twice. The guard makes the loser a no-op.
 */
const approvePendingImage = async ({ id, adminUserId, now = () => new Date() }) => {
    const claimed = await PendingAgentImage.findOneAndUpdate(
        { _id: id, status: STATUS.PENDING },
        { $set: { status: STATUS.APPROVED, reviewedBy: adminUserId, reviewedAt: now() } },
        { returnDocument: 'after' }
    );

    if (!claimed) {
        // Either it does not exist or it was already reviewed. Both are a 409
        // rather than a 404: the caller's assumption about state is what failed.
        const existing = await PendingAgentImage.findById(id).lean();
        if (!existing) throw createError(404, 'No such pending image');
        throw createError(409, `Image is already ${existing.status}`);
    }

    let card;
    try {
        card = await createNewCard(
            {
                content: claimed.caption || '',
                mediaUrl: claimed.imageUrl,
                mediaType: 'image',
            },
            claimed.agentUserId
        );
    } catch (err) {
        // Publishing failed after the row was claimed. Put it back so the image
        // is not stranded in 'approved' with nothing on the feed — otherwise it
        // is invisible to the queue AND absent from the app.
        await PendingAgentImage.updateOne(
            { _id: id },
            { $set: { status: STATUS.PENDING }, $unset: { reviewedBy: '', reviewedAt: '' } }
        );
        throw err;
    }

    const cardId = card?._id || card?.id;
    await PendingAgentImage.updateOne({ _id: id }, { $set: { publishedCardId: cardId } });

    return { pendingImage: { ...claimed.toObject(), publishedCardId: cardId }, card };
};

/** Rejects one image. Publishes nothing, ever — the image simply stops here. */
const rejectPendingImage = async ({ id, adminUserId, note = '', now = () => new Date() }) => {
    const updated = await PendingAgentImage.findOneAndUpdate(
        { _id: id, status: STATUS.PENDING },
        { $set: { status: STATUS.REJECTED, reviewedBy: adminUserId, reviewedAt: now(), reviewNote: note } },
        { returnDocument: 'after' }
    );

    if (!updated) {
        const existing = await PendingAgentImage.findById(id).lean();
        if (!existing) throw createError(404, 'No such pending image');
        throw createError(409, `Image is already ${existing.status}`);
    }

    return updated.toObject();
};

module.exports = {
    queuePendingImage,
    listPendingImages,
    approvePendingImage,
    rejectPendingImage,
    STATUS,
};
