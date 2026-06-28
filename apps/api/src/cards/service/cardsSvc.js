const User = require('../../users/models/User');
const { createError } = require('../../utils/handleErrors');
const normalizeCard = require('../helpers/normalizeCard');
const Card = require('../models/Card')
const Notification = require('../../notifications/models/Notifications');
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
        "status"
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

    // 2. check and change likes
    if(card.likes.includes(userId)){
        card.likes = card.likes.filter(id => id !== userId)
    }
    else{
        card.likes.push(userId);
        if(userId !== card.userId.toString()){
            await new Notification({actionType: 'like',fromUser: userId, toUser: card.userId, whichCard: card._id}).save();
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

    const comment = card.comments.id(commentId);
    if(!comment) throw createError(404, "Comment not found")

    if(comment.likes.includes(userId)){
        comment.likes = comment.likes.filter(id => id !== userId)
    }
    else{
        comment.likes.push(userId);
        if(userId !== comment.userId.toString()){
            await new Notification({actionType: 'comment-like', fromUser: userId, toUser: comment.userId, whichCard: card._id}).save();
        }
    }

    const savedCard = await card.save();
    return pickSafeCardFields(savedCard);
}

const addComment = async (cardId, userId, commentText) => {
    // find the card by ID
    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    card.comments.push({userId, commentText})

    if(userId !== card.userId.toString()){
        await new Notification({actionType: 'comment',fromUser: userId, toUser: card.userId, whichCard: card._id}).save()
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

    const comment = card.comments.id(commentId);
    if(!comment) throw createError(404, "Comment not found")

    comment.replies.push({userId, replyText: replyText.trim()})

    if(userId !== comment.userId.toString()){
        await new Notification({actionType: 'comment-reply', fromUser: userId, toUser: comment.userId, whichCard: card._id}).save()
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

const getFeedCards = async (userId, isAdmin) => {
    const user = await User.findById(userId);
    if(!user) throw createError(404, "User not found");
    
    const hidden = await getHiddenUserIds(userId);
    // following is already cleared on block, but stay defensive about both directions.
    const followingVisible = (user.following || []).filter(id => !hidden.has(String(id)));
    const filter = {userId: {$in: followingVisible}}
    if(!isAdmin){
        filter.status = 'active';
    }

    // find cards where userId is in this array
    const feedCards = await Card.find(filter)
    .limit(30)
    .sort({createdAt: -1});

    return feedCards.map(card => stripBlockedComments(pickSafeCardFields(card), hidden));
}

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
}