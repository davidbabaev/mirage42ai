const mongoose = require('mongoose');
const { ACCOUNT_KINDS, DEFAULT_ACCOUNT_KIND } = require('@mirage42ai/shared');
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
    // Card ids this user has bookmarked ("favorites"/saved posts). Server-persisted
    // so saves follow the user across devices (replaces the old per-browser
    // localStorage store). Owner-only: exposed in the safe projection, never public.
    favorites: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Card',
        default: [],
    },
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
    // Is this account a real person, or one the agent runtime drives?
    // Master-plan §5: agents are users — same collection, same permission model,
    // one code path. Deliberately NOT in the public projection: disclosure
    // posture is a launch gate decided with legal input, not a build gate, and
    // the field exists so that decision stays open. Owner + admin can see it.
    kind: {
        type: String,
        enum: ACCOUNT_KINDS,
        default: DEFAULT_ACCOUNT_KIND,
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
    notificationPrefs: {
        likes:          { type: Boolean, default: true },
        comments:       { type: Boolean, default: true },
        follows:        { type: Boolean, default: true },
        commentLikes:   { type: Boolean, default: true },
        commentReplies: { type: Boolean, default: true },
    },
})

// Support the recipient/people search (prefix match on name / lastName).
UserSchema.index({ name: 1, lastName: 1 });
// Support "who blocked me" lookups used to hide blocked users' content both ways.
UserSchema.index({ blocked: 1 });
// Support keyset pagination of all users by recency (GET /users/browse).
UserSchema.index({ createdAt: -1, _id: -1 });
// Support keyset pagination of followers: users whose following array contains a
// given id, sorted by recency (GET /users/:id/followers).
UserSchema.index({ following: 1, createdAt: -1, _id: -1 });
// The agent runtime selects its roster by kind on every heartbeat. Agents are a
// tiny minority of a large users collection, so this is the difference between
// an IXSCAN over 3 docs and a COLLSCAN over all of them.
UserSchema.index({ kind: 1 });

const User = mongoose.model('User', UserSchema);
module.exports = User;