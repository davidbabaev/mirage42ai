const {verifyToken} = require('./providers/jwt');
const User = require('../users/models/User');

const auth = async (req, res, next) => {
    try{
        const token = req.header('auth-token')
        if(!token){
            return res.status(401).send('No token provided')
            // without return the code keeps going.
        }
        const decoded = verifyToken(token)
        
        const foundUser = await User.findById(decoded.userId)
        if(!foundUser) {
            return res.status(401).send("User not found :(")
        }
        if(foundUser.isBanned === true){
            return res.status(403).send("You Banned :(")
        }
        
        req.user = decoded;
        next()
    }
    catch(err){
        res.status(401).send("Auth token invalid")
    }
}

module.exports = auth;