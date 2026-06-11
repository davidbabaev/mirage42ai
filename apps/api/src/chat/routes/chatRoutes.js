const express = require('express')
const router = express.Router();
const {
    getOrCreateConversation,
    createNewMessage,
    getMessages,
    getChats,
    deleteChat
} = require('../service/chatSvc');
const auth = require('../../auth/authService');
const { handleError } = require('../../utils/handleErrors');
const {upload} = require('../../middlewares/multer');
const uploadToCloudinary = require('../../utils/cloudinary');
const Conversation = require('../models/Conversation');

module.exports = (io) => {
    router.get('/chats', auth, async (req,res) => {
        try{
            const chats = await getChats(req.user.userId);
            res.send(chats)
        }
        catch(err){
            handleError(res, err);
        }
    })
    
    router.get('/messages/:conversationId', auth ,async (req,res) => {
        try{
            const messages = await getMessages(req.params.conversationId);
            res.send(messages)
        }
        catch(err){
            handleError(res, err);
        }
    })
    
    router.delete('/chats/:conversationId', auth, async (req, res) => {
        try{
            const deletedChat = await deleteChat(req.user.userId, req.params.conversationId);

            const otherUserId = deletedChat.fromUser.toString() === req.user.userId 
                ? deletedChat.toUser
                : deletedChat.fromUser 

            console.log('emitting deleted-conversation to:', otherUserId.toString())
            io.to(otherUserId.toString()).emit('deleted-conversation', deletedChat._id)

            res.send(deletedChat)
        }
        catch(err){
            handleError(res, err);
        }
    })

    router.post('/chat/upload-media', auth, upload.single('media'), async (req, res) => {
        try{
            if(!req.file) return res.status(400).send('File not found');

            // 1. get or create conversation first
            const conversation = await getOrCreateConversation(
                req.user.userId,
                req.body.toUser
            );

            // 2. upload file to cloudinary
            const mediaUrl = await uploadToCloudinary(req.file.buffer, "messages");

            // 3. create the message with the conversatinoId we just resloved
            let newMessage = await createNewMessage(
                {
                    ...req.body,
                    conversationId: conversation._id,
                    mediaUrl: mediaUrl,
                    mediaType: req.file.mimetype.startsWith("image/") ? "image" : "video"
                },
                req.user.userId
            );

            // 4. Brodcast - we already have toUser from the request body
            io.to(req.user.userId.toString())
              .to(req.body.toUser.toString())
              .emit('receive-message', newMessage)

            res.send(newMessage);
        }
        catch(err){
            handleError(res, err)
        }
    })

    return router;
}