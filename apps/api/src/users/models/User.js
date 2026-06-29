const mongoose = require('mongoose');
const { 
    URL, 
    EMAIL, 
    DEFAULT_VALIDATOR, 
    PHONE, 
    PASSWORD,
} = require('../helpers/userValidators'); 

const UserSchema = new mongoose.Schema({
    name: DEFAULT_VALIDATOR,
    lastName: DEFAULT_VALIDATOR,
    email: EMAIL,
    password: PASSWORD,
    phone: PHONE,
    profilePicture: URL,
    coverImage: URL,
    age: {
        type: Number,
        max: 120,
    },
    job: {
        type: String,
        maxLength: 50,
    },
    gender: {
        type: String,
        maxLength: 10,
    },
    birthDate: {
        type: Date,
    },
    aboutMe: {
        type: String,
        maxLength: 1024,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    address: {
        country:{
            type: String,
            maxLength: 1024,
        },
        city: {
            type: String,
            maxLength: 1024,
        },
        street: {
            type: String,
            maxLength: 1024,
        },
        house: {
            type: Number,
        },
        zip: {
            type: Number,
        }
    },
    following: [String],
    // userIds this user has blocked. Stored one-directionally but enforced both
    // ways (neither party sees/messages the other). Never exposed in the public
    // projection — only in the owner's own (safe) projection.
    blocked: [String],
    // Active refresh tokens (one record per logged-in device/session). We store
    // only a SHA-256 hash of each token plus its expiry, so a DB leak can't be
    // replayed. Rotated/revoked tokens are pulled from this array.
    refreshTokens: {
        type: [{
            tokenHash: { type: String, required: true },
            expiresAt: { type: Date, required: true },
        }],
        default: [],
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    lastLoginAt: {
        type: Date,
        default: Date.now
    },
    googleId: {
        type: String,
        default: null
    },
    onboardingComplete: {
        type: Boolean,
        default: false,
    },
    interests: {
        type: [String],
        default: [],
    },
})

// Support the recipient/people search (prefix match on name / lastName).
UserSchema.index({ name: 1, lastName: 1 });
// Support "who blocked me" lookups used to hide blocked users' content both ways.
UserSchema.index({ blocked: 1 });

const User = mongoose.model('User', UserSchema);
module.exports = User;