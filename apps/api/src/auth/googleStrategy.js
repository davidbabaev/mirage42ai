const passport = require('passport');
// give me the whole package, then gran just .Strategy from it
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../users/models/User');
const normalizeUser = require('../users/helpers/normalizeUser');

// Find-or-create for Google sign-in, with account linking.
//
// Order matters:
//   1. Match by googleId — a returning Google user.
//   2. Else match by email — an account that already exists (e.g. registered
//      with email/password, googleId: null). Link the googleId onto it so the
//      same person can now sign in either way, instead of inserting a second
//      row and colliding on the unique email index (the E11000 crash).
//   3. Else create a brand-new user.
//
// The insert is guarded against the concurrent-callback race: if two requests
// both reach step 3 for the same new email, one wins and the other catches the
// duplicate-key error (11000), re-fetches the winner, and links/returns it
// rather than 500ing.
async function findOrCreateGoogleUser(profile) {
    const email = profile.emails?.[0]?.value;
    const fullName = (profile.displayName || '').split(' ');

    // 1. Already linked to this Google account.
    let user = await User.findOne({ googleId: profile.id });
    if (user) return user;

    // 2. Existing account with the same email — link and reuse it.
    if (email) {
        user = await User.findOne({ email });
        if (user) {
            user.googleId = profile.id;
            await user.save();
            return user;
        }
    }

    // 3. Brand-new user.
    const googleUser = {
        googleId: profile.id,
        name: fullName[0],
        lastName: fullName.slice(1).join(' '),
        email,
        profilePicture: profile.photos?.[0]?.value,
    };

    try {
        return await new User(normalizeUser(googleUser)).save();
    } catch (err) {
        // Race: a concurrent callback created the account between our lookups
        // and this insert. Recover the winner instead of surfacing a 500.
        if (err.code === 11000) {
            const winner = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
            if (winner) {
                if (!winner.googleId) {
                    winner.googleId = profile.id;
                    await winner.save();
                }
                return winner;
            }
        }
        throw err;
    }
}

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
        const user = await findOrCreateGoogleUser(profile);

        if(user?.isBanned) return done(null, false, {message: "You Banned :("})

        return done(null, user)
    }
    catch(err){
        console.log("Strategy Error:", err.message);
        return done(err)
    }
}))
}

module.exports = { findOrCreateGoogleUser };
