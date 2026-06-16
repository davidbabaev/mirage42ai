const jwt = require('jsonwebtoken');

const SECRET_TOKEN = process.env.JWT_SECRET;

// Short-lived access token; the long-lived refresh token (httpOnly cookie) is
// exchanged for a new one via POST /auth/refresh when this expires.
// Role/ban are intentionally NOT embedded — they are read from the DB on every
// request (see authService.js) so promotions, demotions and bans take effect
// immediately instead of waiting for the token to be reissued.
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';

const signNewToken = (user) => {
    try{
        const signed_token = jwt.sign(
            {userId: user._id},
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