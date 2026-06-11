const {verifyToken} = require('./providers/jwt');

const optionalAuth = (req, res, next) => {
    try{
        const token = req.header('auth-token')
        if(!token){
            return next()
            // without return the code keeps going.
        }
        const decoded = verifyToken(token)
        req.user = decoded;
        next()
    }
    catch(err){
        next();
    }
}

module.exports = optionalAuth;