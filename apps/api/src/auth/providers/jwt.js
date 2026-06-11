const jwt = require('jsonwebtoken');

const SECRET_TOKEN = process.env.JWT_SECRET;


const signNewToken = (user) => {
    try{
        const signed_token = jwt.sign(
            {userId: user._id, isAdmin: user.isAdmin},
            SECRET_TOKEN
        )
        return signed_token;
    }
    catch(err){
        throw new Error(err.message);
    }
}

const verifyToken = (tokenFromHeader) => {
    try{
        const verified = jwt.verify(
            tokenFromHeader,
            SECRET_TOKEN
        )
        return verified;
    }
    catch(err){
        throw new Error(err.message);
    }
}

module.exports = {signNewToken, verifyToken};