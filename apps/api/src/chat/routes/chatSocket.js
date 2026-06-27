const {
    getOrCreateConversation,
    createNewMessage
} = require('../service/chatSvc');
const {
    addConnection,
    removeConnection,
    getOnlineUserIds,
} = require('../service/presenceService');

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

        // Presence: mark this user online. Announce to everyone else only on the
        // user's first connection so extra tabs don't re-broadcast online/offline.
        const { wentOnline } = addConnection(socket.userId);
        if (wentOnline) {
            socket.broadcast.emit('user-online', { userId: socket.userId });
        }

        // Race-free snapshot: the client asks once it has its listeners attached,
        // and we reply only to that socket with the full set of online users.
        socket.on('request-presence', () => {
            socket.emit('presence-snapshot', { userIds: getOnlineUserIds() });
        });

        socket.on('disconnect', () => {
            const { wentOffline } = removeConnection(socket.userId);
            if (wentOffline) {
                socket.broadcast.emit('user-offline', { userId: socket.userId });
            }
        });

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


















