const jwt = require('jsonwebtoken');

const SECRET_TOKEN = process.env.JWT_SECRET;

// Short-lived access token; the long-lived refresh token (httpOnly cookie) is
// exchanged for a new one via POST /auth/refresh when this expires.
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';

const signNewToken = (user) => {
    try{
        const signed_token = jwt.sign(
            {userId: user._id, isAdmin: user.isAdmin},
            SECRET_TOKEN,
            {expiresIn: ACCESS_TOKEN_TTL}
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