const express = require('express');
const passport = require('passport');
const { signNewToken } = require('./providers/jwt');
const { handleError } = require('../utils/handleErrors');
const router = express.Router();

router.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email']}))

router.get('/auth/google/callback', 
    passport.authenticate('google', {
        failureRedirect: `${process.env.CLIENT_URL}/login?error=banned`,
        session: false
    }), 
    async (req,res) => {
    try{
        const token = signNewToken(req.user)
        res.redirect(`${process.env.CLIENT_URL}?token=${token}`)
    }
    catch(err){
        console.log("Handle Error: ", err.message);
        handleError(res, err)
    }
})

module.exports = router;
