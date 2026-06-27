const User = require('../../users/models/User');
const { createError } = require('../../utils/handleErrors');
const normalizeCard = require('../helpers/normalizeCard');
const Card = require('../models/Card')
const Notification = require('../../notifications/models/Notifications');
const _ = require('lodash');

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

const getCards = async (isAdmin) => {
        const filter = isAdmin ? {} : {status: 'active'}
        const cards = await Card.find(filter)
        return cards.map(card => pickSafeCardFields(card))
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
const getPublicCard = async (cardId, isAdmin) => {
        const card = await Card.findById(cardId)
        if(!card) throw createError(404, "Card not found")
        if(!isAdmin && card.status !== 'active') throw createError(404, "Card not found")
        return pickSafeCardFields(card);
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
    
    const filter = {userId: {$in: user.following}}
    if(!isAdmin){
        filter.status = 'active';
    }

    // find cards where userId is in this array
    const feedCards = await Card.find(filter)
    .limit(30)
    .sort({createdAt: -1});

    return feedCards.map(card => pickSafeCardFields(card));   
}

const banCard = async (cardId) => {
    let card = await Card.findById(cardId);
    if(!card) throw createError(404, 'Card not found');

    card.status = card.status === 'banned' ? 'active' : 'banned';

    card = await card.save();
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
    removeComment,
    getFeedCards,
    banCard,
}