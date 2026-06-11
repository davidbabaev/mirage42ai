const passport = require('passport');
// give me the whole package, then gran just .Strategy from it
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../users/models/User');
const normalizeUser = require('../users/helpers/normalizeUser');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
passport.use(new GoogleStrategy({
    // config object - your credentials
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SERVER_URL}/auth/google/callback`
},

async (accessToken, refreshToken, profile, done) => {
    // callback - what to do with the user Google returns
    try{
        const user = await User.findOne({googleId: profile.id})
        const fullName = profile.displayName.split(' ');

        if(user?.isBanned) return done(null, false, {message: "You Banned :("})

        if(!user){
            // build the raw data from google
            const googleUser = {
                googleId: profile.id,
                name: fullName[0],
                lastName: fullName.slice(1).join(' '),
                email: profile.emails[0].value,
                profilePicture: profile.photos[0].value,
                
            };
            
            // normalize the data
            const normalizeData = normalizeUser(googleUser);
            
            // create and save
            const newUser = await new User(normalizeData).save();
            
            return done(null, newUser)
        }
        else{
            return done(null, user)
        }
    }
    catch(err){
        console.log("Strategy Error:", err.message);
        return done(err)
    }
}))
}