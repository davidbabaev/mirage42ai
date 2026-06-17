const {
    getOrCreateConversation,
    createNewMessage
} = require('../service/chatSvc');

const jwt = require('jsonwebtoken');
const User = require('../../users/models/User');


module.exports = (io) => {
    // verify JWT here
    // if bad: disconnect them
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;

        if(!token) return next(new Error('No token provided'))

        try{
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Role/ban from the DB, not the token (same policy as the HTTP auth
            // middleware), so a banned user can't ride an old token onto a socket.
            const foundUser = await User.findById(decoded.userId);
            if(!foundUser || foundUser.isBanned) return next(new Error('Invalid token'))

            socket.userId = decoded.userId;
            socket.isAdmin = foundUser.isAdmin;

            next();
        }
        catch(err){
            return next(new Error('Invalid token'))
        }
    })

    io.on('connection', (socket) => {
        socket.join(socket.userId) // <- join personal room immediately on connect
        console.log('user connected and joined room:', socket.userId)

        socket.on('send-message', async (message) => {
            try{
                const conversation = await getOrCreateConversation(socket.userId, message.toUser)

                const newMessage = await createNewMessage(
                    {...message, conversationId: conversation._id},
                    socket.userId
                )

                io.to(socket.userId).to(message.toUser).emit('receive-message', newMessage)
            }
            catch(err){
                console.log('send-message error:', err.message);
                socket.emit('send-message-error', {message: err.message});
            }
        })
    })
}


















