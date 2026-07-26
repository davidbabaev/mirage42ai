const PendingAgentImage = require('../models/PendingAgentImage');
const { STATUS } = require('../models/PendingAgentImage');
const AgentPersona = require('../models/AgentPersona');
const { createNewCard } = require('../../cards/service/cardsSvc');
const { createError } = require('../../utils/handleErrors');
const User = require('../../users/models/User');
const { ACCOUNT_KIND } = require('@mirage42ai/shared');
const { moderateImage } = require('./agentImageModeration');

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
const approvePendingImage = async ({ id, adminUserId = null, auto = false, now = () => new Date() }) => {
    // The claim's $set carries who acted: a human's id in reviewedBy, or the
    // autoApproved flag when the automated path published it (no human, so no
    // reviewedBy). Everything after this point — createNewCard, the rollback, the
    // publishedCardId stamp — is identical for both, which is what keeps this the
    // SINGLE path from a generated image to a Card.
    const set = { status: STATUS.APPROVED, reviewedAt: now() };
    if (adminUserId) set.reviewedBy = adminUserId;
    if (auto) set.autoApproved = true;

    const claimed = await PendingAgentImage.findOneAndUpdate(
        { _id: id, status: STATUS.PENDING },
        { $set: set },
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

/**
 * Runs a queued image through automated moderation and, only on a clean pass,
 * publishes it. The safety gate for auto-publish (§7).
 *
 * FAILS CLOSED. A "rejected" verdict AND an image the moderator could not check
 * (no add-on, provider error, unparseable url, inconclusive result) BOTH leave
 * the image `pending` for a human, with the reason recorded. The only thing that
 * publishes an image here is an explicit pass — because with the human reviewer
 * gone, "not sure" has to mean "don't publish", not "publish anyway".
 *
 * Publishing still goes through `approvePendingImage`, so an auto-published image
 * is the same ordinary Card an admin approval would produce — one path to the
 * feed, never two.
 */
const moderateAndPublish = async ({ id, moderateImpl = moderateImage, now = () => new Date() } = {}) => {
    const row = await PendingAgentImage.findById(id).lean();
    if (!row) throw createError(404, 'No such pending image');
    if (row.status !== STATUS.PENDING) throw createError(409, `Image is already ${row.status}`);

    const verdict = await moderateImpl({ imageUrl: row.imageUrl });
    const moderation = {
        status: verdict?.status || 'unavailable',
        reason: verdict?.reason || '',
        provider: verdict?.provider || '',
        checkedAt: now(),
    };

    if (!verdict?.ok) {
        // HOLD for human review. Nothing is published; the row stays pending and
        // records why, so the queue shows an admin what the moderator objected to.
        await PendingAgentImage.updateOne(
            { _id: id, status: STATUS.PENDING },
            { $set: { moderation, reviewNote: `auto-publish held: ${moderation.reason || moderation.status}` } }
        );
        return { published: false, status: STATUS.PENDING, moderation };
    }

    const result = await approvePendingImage({ id, auto: true, now });
    await PendingAgentImage.updateOne({ _id: id }, { $set: { moderation } });
    return {
        published: true,
        status: STATUS.APPROVED,
        cardId: result.pendingImage.publishedCardId,
        moderation,
    };
};

/**
 * Files a generated image and then EITHER leaves it for human review OR, when
 * the persona opts in and the image passes moderation, publishes it.
 *
 * The auto-publish decision is read from the persona document HERE, server-side.
 * It is never taken from the caller: the runtime hands over bytes and text, and
 * this — reading the authoritative `autoPublishImages` flag — is what decides.
 * A missing persona or a false flag keeps the original, unchanged behaviour: the
 * image waits in the queue for an admin.
 */
const submitAndMaybePublish = async ({
    agentUserId, imageUrl, caption = '', prompt, model, includedFace = true,
    moderateImpl = moderateImage, now = () => new Date(),
} = {}) => {
    const pending = await queuePendingImage({ agentUserId, imageUrl, caption, prompt, model, includedFace });

    const persona = await AgentPersona.findOne({ userId: agentUserId }, 'autoPublishImages').lean();
    if (!persona?.autoPublishImages) {
        return { id: pending._id, status: pending.status, autoPublish: false };
    }

    const outcome = await moderateAndPublish({ id: pending._id, moderateImpl, now });
    return { id: pending._id, autoPublish: true, ...outcome };
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
    moderateAndPublish,
    submitAndMaybePublish,
    STATUS,
};
