const express = require('express')
const router = express.Router();
const {
    getOrCreateConversation,
    createNewMessage,
    getMessages,
    getChats,
    markConversationRead,
    deleteChat
} = require('../service/chatSvc');
const auth = require('../../auth/authService');
const { handleError } = require('../../utils/handleErrors');
const {upload} = require('../../middlewares/multer');
const uploadToCloudinary = require('../../utils/cloudinary');

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
            const { messages, nextCursor } = await getMessages(
                req.params.conversationId,
                req.user.userId,
                { cursor: req.query.cursor, limit: req.query.limit },
            );
            res.send({ messages, nextCursor })
        }
        catch(err){
            handleError(res, err);
        }
    })

    // Mark a conversation read for the requesting user; notify their other tabs.
    router.patch('/chats/:conversationId/read', auth, async (req, res) => {
        try{
            const conversation = await markConversationRead(req.user.userId, req.params.conversationId);
            io.to(req.user.userId.toString()).emit('conversation-read', { conversationId: conversation._id })
            res.send({ conversationId: conversation._id })
        }
        catch(err){
            handleError(res, err);
        }
    })
    
    router.delete('/chats/:conversationId', auth, async (req, res) => {
        try{
            const { conversation } = await deleteChat(req.user.userId, req.params.conversationId);

            // Per-side delete: only the deleter loses the conversation. Notify
            // the DELETER's own room so their other tabs/devices drop it too.
            // The other participant's copy (and the messages) stay intact, so we
            // do NOT emit to them.
            io.to(req.user.userId.toString()).emit('deleted-conversation', conversation._id)

            res.send(conversation)
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