const {verifyToken} = require('./providers/jwt');
const User = require('../users/models/User');

// Like `auth`, but never blocks: an absent/invalid/expired token just leaves
// req.user undefined. When a valid token IS present we still read the role from
// the DB (not the token) so admin-only views stay consistent with `auth`.
const optionalAuth = async (req, res, next) => {
    try{
        const token = req.header('auth-token')
        if(!token){
            return next()
            // without return the code keeps going.
        }
        const decoded = verifyToken(token)
        const foundUser = await User.findById(decoded.userId)
        if(foundUser && !foundUser.isBanned){
            req.user = { userId: decoded.userId, isAdmin: foundUser.isAdmin };
        }
        next()
    }
    catch(err){
        next();
    }
}

module.exports = optionalAuth;
