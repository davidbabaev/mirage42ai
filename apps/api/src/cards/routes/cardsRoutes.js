// this file will hold your app.get, app.post etc. for cards

const express = require('express');
const router = express.Router();
const {handleError, createError} = require('../../utils/handleErrors');
const joiSchema = require('../validation/Joi/validateCardsWithJoi');
const {upload} = require('../../middlewares/multer');
const uploadToCloudinary = require('../../utils/cloudinary');

const {
    createNewCard, 
    getCards, 
    getCard, 
    updateCard, 
    deleteCard, 
    likeCard,
    pickSafeCardFields,
    addComment,
    removeComment,
    getFeedCards,
    banCard,
} = require('../service/cardsSvc');
const auth = require('../../auth/authService');
const optionalAuth = require('../../auth/optionalAuth');

router.get('/cards', optionalAuth ,async (req, res) => {
    try{
        const cards = await getCards(req.user?.isAdmin);
        res.send(cards);
    }
    catch(err){
        handleError(res, err);
    }
})

router.get('/cards/feed', auth, async (req,res) => {
    try{
        const feedCards = await getFeedCards(req.user.userId, req.user.isAdmin)
        res.send(feedCards) // <- send them back
    }
    catch(err){
        handleError(res, err)
        console.log(err.message);
    }
})


router.post('/cards', auth, upload.single('media'), async (req, res) => {
    try{
        const { error } = joiSchema.validate(req.body);
        if(error){
            return res.status(400).send(error.details[0].message);
        }
        
        if(!req.file){
            return res.status(400).send('File not found')
        }
        const mediaUrl = await uploadToCloudinary(req.file.buffer, "cards")
        let newCard = await createNewCard(
            {
                ...req.body, 
                mediaUrl:mediaUrl, 
                mediaType: req.file.mimetype.startsWith("image/") ? "image" : "video"
            }
            , req.user.userId
        );
        res.send(newCard);
    }
    catch(err){
        handleError(res, err);
        console.log(err.message);
    }
})

router.get('/cards/:id',async (req, res) => {
    try{
        const card = await getCard(req.params.id); // -> dynamic!
        res.send(pickSafeCardFields(card));
    }
    catch(err){
        handleError(res, err);
        console.log(err.message);
        
    }
})

router.put('/cards/:id', auth, upload.single('media'), async (req, res) => {
    try{
        const card = await getCard(req.params.id)

        if(req.user.userId === card.userId.toString() || req.user.isAdmin){

            let img = card.mediaUrl;
            let media = card.mediaType;
            let mediaUrl;
            let mediaType;
            
            if(req.file){
                mediaUrl = await uploadToCloudinary(req.file.buffer, "cards")
                mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image"
            }
            else{
                mediaUrl = img
                mediaType = media
            }

            let updatedCard = await updateCard(req.params.id, 
                {
                    ...req.body,
                    mediaUrl: mediaUrl,
                    mediaType: mediaType
                });
            res.send(pickSafeCardFields(updatedCard));
        }
        else{
            res.status(403).send('You not allowed to edit this card')
        }
    }
    catch(err){
        handleError(res, err);
    }
})

router.delete('/cards/:id', auth, async (req, res) => {
    try{
        const card = await getCard(req.params.id)
        if(req.user.userId === card.userId.toString() || req.user.isAdmin){
            let deletedCard = await deleteCard(req.params.id);
            res.send(pickSafeCardFields(deletedCard));
        }
        else{
            res.status(403).send('Your not allowed to delete this card')
        }
    }
    catch(err){
        handleError(res, err);
    }
})


router.patch('/cards/:id', auth, async (req, res) => {
    try{
        let cardLike = await likeCard(req.params.id, req.user.userId)
        res.send(cardLike)
    }
    catch(err){
        handleError(res, err);
    }
})

// PATCH /cards/:id/comments ← add comment (which card)
router.patch('/cards/:id/comments', auth, async (req, res) => {
    try{
        let addingComment = await addComment(req.params.id, req.user.userId, req.body.commentText)
        res.send(addingComment)
    }
    catch(err){
        handleError(res, err);
    }
})

// PATCH /cards/:id/comments/:commentId  ← remove comment (which card + which comment)
router.patch('/cards/:id/comments/:commentId', auth, async (req, res) => {
    try{
        let deleteComment = await removeComment(req.params.id, req.params.commentId)
        res.send(deleteComment)
    }
    catch(err){
        handleError(res, err);
    }
})

router.patch('/cards/:id/ban', auth, async (req,res) => {
    try{
        if(!req.user.isAdmin) throw createError(403, 'Only Admin can ban cards')
        const bannedUser = await banCard(req.params.id)
        res.send(bannedUser)
    }
    catch(err){
        handleError(res, err);
    }
})

module.exports = router;







