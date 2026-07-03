const User = require('../../users/models/User');
const { createError } = require('../../utils/handleErrors');
const normalizeCard = require('../helpers/normalizeCard');
const Card = require('../models/Card')
const Notification = require('../../notifications/models/Notifications');
const { normalizeLimit, decodeCursor, runKeysetPage } = require('../../utils/cursorPagination');
const _ = require('lodash');

// Ids whose content the requester must not see: users they blocked AND users
// who blocked them (block is enforced both directions, like getUsers). Empty
// for a logged-out requester.
const getHiddenUserIds = async (requesterId) => {
    if(!requesterId) return new Set();
    const me = await User.findById(requesterId);
    const iBlocked = (me?.blocked || []).map(String);
    const blockedMe = await User.find({ blocked: requesterId }, '_id');
    return new Set([...iBlocked, ...blockedMe.map(u => String(u._id))]);
}

// Drop comments (and replies) authored by a hidden user from a plain card object,
// so a blocked user's comments never surface to the requester.
const stripBlockedComments = (cardObj, hiddenSet) => {
    if(!hiddenSet.size || !cardObj.comments) return cardObj;
    cardObj.comments = cardObj.comments
        .filter(c => !hiddenSet.has(String(c.userId)))
        .map(c => ({
            ...c,
            replies: (c.replies || []).filter(r => !hiddenSet.has(String(r.userId))),
        }));
    return cardObj;
}

// True if a block exists in EITHER direction between two users — one indexed
// lookup against the `blocked` array (see User index). Used to reject writes
// across a block and to suppress notifications to/from a blocked user. A read
// already 404s the card; this closes the matching hole on the write/notify side.
const blockExistsBetween = async (aId, bId) => {
    if(!aId || !bId || String(aId) === String(bId)) return false;
    const hit = await User.findOne({
        $or: [
            { _id: aId, blocked: String(bId) },
            { _id: bId, blocked: String(aId) },
        ],
    }, '_id');
    return !!hit;
}

const pickSafeCardFields = (card) => {
    return _.pick(card.toObject() ,[
        "title",
        "content",
        "web",
        "mediaUrl",
        "mediaType",
        "location",
        "category",
        "likes",
        "comments",
        "createdAt",
        "_id",
        "userId",
        "status",
        "reportCount"
    ])
}

const createNewCard = async (card, userId) => {
    try{
        card = normalizeCard(card) // fill defaults
        let newCard = new Card({...card, userId})
        newCard = await newCard.save();
        // return newCard;
        return pickSafeCardFields(newCard)
    }
    catch(err){
        throw err;
    }
}

const getCards = async (requesterId, isAdmin) => {
        const hidden = await getHiddenUserIds(requesterId);
        const filter = isAdmin ? {} : {status: 'active'}
        // Hide posts authored by a blocked user (either direction).
        if(hidden.size) filter.userId = { $nin: [...hidden] };
        const cards = await Card.find(filter)
        return cards.map(card => stripBlockedComments(pickSafeCardFields(card), hidden))
}

// Raw fetch for internal/owner operations (edit, delete, like, comment):
// returns the Mongoose doc regardless of status.
const getCard = async (cardId) => {
        const card = await Card.findById(cardId)
        if(!card) throw createError(404, "Card not found")
        return card;
}

// Public-facing single-card read: banned/deleted cards are invisible to
// non-admins (server-side, where the ban is real). Admins see everything.
const getPublicCard = async (cardId, requesterId, isAdmin) => {
        const card = await Card.findById(cardId)
        if(!card) throw createError(404, "Card not found")
        if(!isAdmin && card.status !== 'active') throw createError(404, "Card not found")
        // A blocked author's post is invisible to the requester (either direction).
        const hidden = await getHiddenUserIds(requesterId);
        if(hidden.has(String(card.userId))) throw createError(404, "Card not found")
        return stripBlockedComments(pickSafeCardFields(card), hidden);
}

const updateCard = async (cardId, upCard) => {
        let updatedCard = await Card.findByIdAndUpdate(cardId, upCard, {new: true});
        if(!updatedCard) throw createError(404, "Cannot update card ");
        return updatedCard;
}

const deleteCard = async (cardId) => {
        const deletedCard = await Card.findByIdAndDelete(cardId);
        if(!deletedCard) throw createError(404, "Cannot delete card")
        return deletedCard;
}

const likeCard = async (cardById, userId) => {
    // 1. find the card by id
    const card = await Card.findById(cardById);
    if(!card) throw createError(404, "Card not found")

    // No interacting across a block (either direction) — the card is already
    // invisible to a blocked viewer on read; reject the write to match.
    if(await blockExistsBetween(userId, card.userId)) throw createError(403, "Action not allowed")

    // 2. check and change likes
    if(card.likes.includes(userId)){
        card.likes = card.likes.filter(id => id !== userId)
    }
    else{
        card.likes.push(userId);
        if(userId !== card.userId.toString()){
            // Gate on recipient's per-type pref. One targeted read with projection.
            const recipient = await User.findById(card.userId, 'notificationPrefs').lean();
            if(recipient?.notificationPrefs?.likes !== false){
                await new Notification({actionType: 'like',fromUser: userId, toUser: card.userId, whichCard: card._id}).save();
            }
        }
    }
    // 3. save after changes
    const savedCard = await card.save();

    // 4. return
    return pickSafeCardFields(savedCard);
}

// Toggle a like on an embedded comment. Mirrors likeCard: same string-array
// toggle and the same fire-once notification — but the recipient is the COMMENT
// author (not the card owner), and self-likes don't notify.
const likeComment = async (cardId, commentId, userId) => {
    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    // Reject the write across a block with the post owner.
    if(await blockExistsBetween(userId, card.userId)) throw createError(403, "Action not allowed")

    const comment = card.comments.id(commentId);
    if(!comment) throw createError(404, "Comment not found")

    if(comment.likes.includes(userId)){
        comment.likes = comment.likes.filter(id => id !== userId)
    }
    else{
        comment.likes.push(userId);
        // The recipient is the COMMENT author, who may be a third party — guard
        // the notification against a block between actor and comment author.
        if(userId !== comment.userId.toString() && !(await blockExistsBetween(userId, comment.userId))){
            const recipient = await User.findById(comment.userId, 'notificationPrefs').lean();
            if(recipient?.notificationPrefs?.commentLikes !== false){
                await new Notification({actionType: 'comment-like', fromUser: userId, toUser: comment.userId, whichCard: card._id, commentId: comment._id}).save();
            }
        }
    }

    const savedCard = await card.save();
    return pickSafeCardFields(savedCard);
}

const addComment = async (cardId, userId, commentText) => {
    // find the card by ID
    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    if(await blockExistsBetween(userId, card.userId)) throw createError(403, "Action not allowed")

    card.comments.push({userId, commentText})

    if(userId !== card.userId.toString()){
        const recipient = await User.findById(card.userId, 'notificationPrefs').lean();
        if(recipient?.notificationPrefs?.comments !== false){
            await new Notification({actionType: 'comment',fromUser: userId, toUser: card.userId, whichCard: card._id}).save()
        }
    }

    // save after changes
    const saveComment = await card.save();
    // return picked
    return pickSafeCardFields(saveComment)
}

// Add a single-level reply to an embedded comment. Mirrors addComment, but the
// reply lives under the parent comment and the notification (comment-reply)
// goes to the COMMENT author, not the card owner. Self-replies don't notify.
const addReply = async (cardId, commentId, userId, replyText) => {
    if(!replyText || !replyText.trim()) throw createError(400, "Reply text is required")

    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    if(await blockExistsBetween(userId, card.userId)) throw createError(403, "Action not allowed")

    const comment = card.comments.id(commentId);
    if(!comment) throw createError(404, "Comment not found")

    comment.replies.push({userId, replyText: replyText.trim()})

    // Recipient is the COMMENT author (possibly a third party) — suppress the
    // notification if a block exists between actor and comment author.
    if(userId !== comment.userId.toString() && !(await blockExistsBetween(userId, comment.userId))){
        const recipient = await User.findById(comment.userId, 'notificationPrefs').lean();
        if(recipient?.notificationPrefs?.commentReplies !== false){
            await new Notification({actionType: 'comment-reply', fromUser: userId, toUser: comment.userId, whichCard: card._id, commentId: comment._id}).save()
        }
    }

    const savedCard = await card.save();
    return pickSafeCardFields(savedCard);
}

const removeComment = async (cardId, commentId) => {
    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    card.comments = card.comments.filter(comment => comment._id.toString() !== commentId)

    const saveComment = await card.save();
    return pickSafeCardFields(saveComment)
}

// Cursor-paginated feed. Returns { cards, nextCursor } where nextCursor is an
// opaque keyset cursor (createdAt + _id) or null at the end. opts: { cursor, limit }.
// The blocked-user filter is applied to EVERY page (computed once per request),
// so no blocked author's post can leak on any page.
const getFeedCards = async (userId, isAdmin, opts = {}) => {
    const user = await User.findById(userId);
    if(!user) throw createError(404, "User not found");

    const pageSize = normalizeLimit(opts.limit);
    let decoded = null;
    if (opts.cursor) {
        decoded = decodeCursor(opts.cursor);
        if (!decoded) throw createError(400, "Invalid feed cursor");
    }

    const hidden = await getHiddenUserIds(userId);
    // following is already cleared on block, but stay defensive about both directions.
    const followingVisible = (user.following || []).filter(id => !hidden.has(String(id)));

    // Cold-start "Suggested for you" feed: when the viewer follows nobody visible,
    // page over recent active public posts (excluding self + blocked authors) so a
    // new user never lands on a blank feed. Ordered by createdAt like the following
    // feed, so the same keyset cursor yields stable, dupe-free pages. (Previously
    // this path re-ranked by likes in-app, which cannot be paged with a stable
    // cursor — recency is used instead. See decisions log.)
    const suggested = followingVisible.length === 0;

    let baseFilter;
    if (suggested) {
        baseFilter = {
            status: 'active',
            userId: { $nin: [...hidden, String(userId)] },
        };
    } else {
        baseFilter = { userId: { $in: followingVisible } };
        if (!isAdmin) baseFilter.status = 'active';
    }

    const { page, nextCursor } = await runKeysetPage(Card, baseFilter, decoded, pageSize);

    const cards = page.map(card => {
        const safe = stripBlockedComments(pickSafeCardFields(card), hidden);
        return suggested ? { ...safe, isSuggested: true } : safe;
    });

    return { cards, nextCursor };
}

// GET /cards/:id/likes — paginated list of users who liked a card.
// Block-aware both directions: hidden users are excluded from the likers list
// and a hidden card author 404s the whole request (mirror getPublicCard).
// Cursor = base64-encoded skip offset, consistent with getSuggestedUsers.
const getCardLikes = async (cardId, requesterId, isAdmin, opts = {}) => {
    // Verify card visibility (mirrors getPublicCard semantics)
    const card = await Card.findById(cardId);
    if (!card) throw createError(404, 'Card not found');
    if (!isAdmin && card.status !== 'active') throw createError(404, 'Card not found');

    const hidden = await getHiddenUserIds(requesterId);
    if (hidden.has(String(card.userId))) throw createError(404, 'Card not found');

    // Parse pagination options
    const lim = Math.min(Math.max(Number(opts.limit) || 20, 1), 100);
    const skip = opts.cursor
        ? parseInt(Buffer.from(opts.cursor, 'base64').toString('utf8'), 10) || 0
        : 0;

    // Filter likers: exclude blocked-either-way users
    const filteredLikerIds = (card.likes || []).filter(id => !hidden.has(String(id)));

    // Apply cursor (offset-based)
    const pageIds = filteredLikerIds.slice(skip, skip + lim);
    const hasMore = filteredLikerIds.length > skip + lim;
    const nextCursor = hasMore
        ? Buffer.from(String(skip + lim)).toString('base64')
        : null;

    if (!pageIds.length) return { users: [], nextCursor };

    // Fetch user details for this page — single query, only fields we expose
    const users = await User.find(
        { _id: { $in: pageIds } },
        '_id name lastName job profilePicture'
    ).lean();

    // Compute follower counts for the page in ONE aggregation (no N+1)
    const pageIdStrs = pageIds.map(String);
    const followerAgg = await User.aggregate([
        { $match: { following: { $in: pageIdStrs } } },
        { $unwind: '$following' },
        { $match: { following: { $in: pageIdStrs } } },
        { $group: { _id: '$following', count: { $sum: 1 } } },
    ]);
    const followerCountMap = {};
    for (const row of followerAgg) {
        followerCountMap[String(row._id)] = row.count;
    }

    // isFollowing: whether the requester follows each liker
    let myFollowingSet = new Set();
    if (requesterId) {
        const me = await User.findById(requesterId, 'following').lean();
        myFollowingSet = new Set((me?.following || []).map(String));
    }

    return {
        users: users.map(u => ({
            _id: u._id,
            name: u.name,
            lastName: u.lastName,
            job: u.job,
            profilePicture: u.profilePicture,
            followersCount: followerCountMap[String(u._id)] || 0,
            isFollowing: myFollowingSet.has(String(u._id)),
        })),
        nextCursor,
    };
};

const banCard = async (cardId) => {
    let card = await Card.findById(cardId);
    if(!card) throw createError(404, 'Card not found');

    const willBeBanned = card.status !== 'banned';
    card.status = willBeBanned ? 'banned' : 'active';

    card = await card.save();

    // Notify the author their post was removed — only on the active->banned
    // transition (not on un-ban). No fromUser: the moderator's identity is
    // deliberately not exposed.
    if(willBeBanned){
        await new Notification({actionType: 'post-removed', toUser: card.userId, whichCard: card._id}).save();
    }

    return pickSafeCardFields(card);
}

module.exports = {
    createNewCard,
    getCards,
    getCard,
    getPublicCard,
    updateCard,
    deleteCard,
    likeCard,
    likeComment,
    pickSafeCardFields,
    addComment,
    addReply,
    removeComment,
    getFeedCards,
    banCard,
    getCardLikes,
    getHiddenUserIds,
}