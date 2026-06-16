const express = require('express');
const passport = require('passport');
const { signNewToken } = require('./providers/jwt');
const { issueRefreshToken, setRefreshCookie } = require('./refreshTokens');
const { handleError } = require('../utils/handleErrors');
const router = express.Router();

const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (googleConfigured) {
    router.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email']}))

    router.get('/auth/google/callback',
        passport.authenticate('google', {
            failureRedirect: `${process.env.CLIENT_URL}/login?error=banned`,
            session: false
        }),
        async (req,res) => {
        try{
            const token = signNewToken(req.user)
            // Set the refresh cookie on this API-origin response, then hand the
            // short-lived access token to the SPA via the redirect URL (as before).
            const refreshToken = await issueRefreshToken(req.user)
            setRefreshCookie(res, refreshToken)
            res.redirect(`${process.env.CLIENT_URL}?token=${token}`)
        }
        catch(err){
            console.log("Handle Error: ", err.message);
            handleError(res, err)
        }
    })
} else {
    const notConfigured = (req, res) => res.status(503).send('Google login not configured');
    router.get('/auth/google', notConfigured);
    router.get('/auth/google/callback', notConfigured);
}

module.exports = router;
