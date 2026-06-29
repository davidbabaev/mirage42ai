const User = require('../models/User');
const _ = require('lodash');
const {generateUserPassword, comparePassword} = require('../helpers/bcrypt');
const {signNewToken} = require('../../auth/providers/jwt');
const {issueRefreshToken} = require('../../auth/refreshTokens');
const { createError } = require('../../utils/handleErrors');
const normalizeUser = require('../helpers/normalizeUser');
const Card = require('../../cards/models/Card');
const Notification = require('../../notifications/models/Notifications');
 
const pickSafeUserFields = (user) => {
    return _.pick(user.toObject() , [
        "name",
        "lastName",
        "email",
        "phone",
        "profilePicture",
        "coverImage",
        "address",
        "age",
        "job",
        "gender",
        "birthDate",
        "aboutMe",
        "createdAt",
        "_id",
        "following",
        "blocked",
        "isAdmin",
        "isBanned",
        "lastLoginAt",
        "onboardingComplete",
        "interests",
        "notificationPrefs",
    ]);
}

// Public projection: what any logged-in user may see about OTHER users.
// Excludes PII/operational fields (email, phone, birthDate, isAdmin, isBanned,
// lastLoginAt) and trims the address to country + city only.
const pickPublicUserFields = (user) => {
    const obj = user.toObject();
    const fields = _.pick(obj, [
        "name",
        "lastName",
        "profilePicture",
        "coverImage",
        "age",
        "job",
        "gender",
        "aboutMe",
        "createdAt",
        "_id",
        "following",
    ]);
    fields.address = _.pick(obj.address || {}, ["country", "city"]);
    return fields;
}

// Full fields for admins and for a user's own record; public fields otherwise.
const projectUser = (user, requesterId, isAdmin) => {
    const isSelf = requesterId && String(user._id) === String(requesterId);
    return (isAdmin || isSelf) ? pickSafeUserFields(user) : pickPublicUserFields(user);
}

// MongoDB operation

const createNewUser = async (user) => {
    try{
        user.password = await generateUserPassword(user.password)
        const normalizedUser = normalizeUser(user)
        let newUser = new User(normalizedUser);
        newUser = await newUser.save();

        const token = signNewToken(newUser);
        const refreshToken = await issueRefreshToken(newUser);
        const safeUser = pickSafeUserFields(newUser);
        return{token, refreshToken, safeUser}
    }
    catch(err){
        throw err;        
    }
}

const loginUser = async ({email, password}) => {
    try{
        // find the user by email in mongoDB
        let user = await User.findOne({email});
        if(!user) throw createError(401, "Invalid email or password");
        if(user.isBanned) throw createError(400, "You Banned :(");

        // compare plain password with hashed password form DB
        const isMatch = await comparePassword(password, user.password);
        if(!isMatch) throw createError(401, "Invalid email or password");

        user.lastLoginAt = Date.now()

        // password correct --> generate JWT access token + a rotating refresh token.
        // issueRefreshToken persists the user (saving lastLoginAt too).
        const token = signNewToken(user);
        const refreshToken = await issueRefreshToken(user);
        const safeUser = pickSafeUserFields(user);
        return{token, refreshToken, safeUser}
    }
    catch(err){
        throw err;
    }
}

// Escape user input before using it in a RegExp so a search term can't inject
// regex metacharacters (ReDoS / unintended matches).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `opts.q` turns this into a server-side search (prefix match on name or
// lastName, case-insensitive) capped by `opts.limit` — so a recipient picker
// never has to load all 100k+ users. Without `q` it returns the full list
// (existing behavior).
// PERF NOTE: a case-insensitive prefix regex is not fully index-served; for very
// large collections back this with a collation index or a search service. The
// limit keeps the result set bounded for the autocomplete use case.
const getUsers = async (requesterId, isAdmin, opts = {}) => {
        // A block is a personal preference and applies to the requester's own
        // view even if they're an admin: never list users they blocked, or users
        // who blocked them. (Admin field-level visibility is unchanged below.)
        const filter = {};
        if(requesterId){
            const requester = await User.findById(requesterId);
            const blockedByMe = requester?.blocked || [];
            filter._id = { $nin: blockedByMe };
            filter.blocked = { $ne: requesterId };
        }

        const q = (opts.q || '').trim();
        let query = User.find(filter);
        if(q){
            const rx = new RegExp('^' + escapeRegex(q), 'i');
            query = User.find({ ...filter, $or: [{ name: rx }, { lastName: rx }] });
            const limit = Math.min(Math.max(Number(opts.limit) || 10, 1), 25);
            query = query.limit(limit);
        }

        const users = await query;
        return users.map(user => projectUser(user, requesterId, isAdmin))
}

// The requester's own blocked list, with just enough to render a settings row
// (id + name + avatar) and an Unblock action. Owner-only by construction — it
// reads the caller's own `blocked` array.
const getBlockedUsers = async (requesterId) => {
        const me = await User.findById(requesterId);
        if(!me) throw createError(404, "User not found");
        const ids = me.blocked || [];
        if(!ids.length) return [];
        const users = await User.find({ _id: { $in: ids } });
        return users.map(u => _.pick(u.toObject(), ['_id', 'name', 'lastName', 'profilePicture']));
}

const getUser = async (userId, requesterId, isAdmin) => {
        const user = await User.findById(userId);
        if(!user) throw createError(401, "User not found")
        // A blocked relationship (either direction) hides the profile — return
        // 404 so it's indistinguishable from "no such user". Applies to admins
        // too (their own block), but never to viewing your own profile.
        if(requesterId && String(userId) !== String(requesterId)){
            const requester = await User.findById(requesterId);
            const iBlocked = (requester?.blocked || []).map(String).includes(String(userId));
            const theyBlocked = (user.blocked || []).map(String).includes(String(requesterId));
            if(iBlocked || theyBlocked) throw createError(404, "User not found")
        }
        return projectUser(user, requesterId, isAdmin)
}

const updateUser = async (userId, content) => {
    const normalizeContent = normalizeUser(content);
    const updatedUser = await User.findByIdAndUpdate(userId, normalizeContent, {new: true});
    if(!updatedUser) throw createError(404, "Update not not possible")
    return pickSafeUserFields(updatedUser)
}

const followUser = async (userId, followingUserId) => {
    // cannot follow yourself
    if(userId === followingUserId) throw createError(400, "Cannot Follow Yourself")

    const user = await User.findById(userId);
    if(!user) throw createError(404, 'User didnt found')

    // Cannot follow across a block (either direction).
    const target = await User.findById(followingUserId);
    if(!target) throw createError(404, 'User didnt found')
    if((user.blocked || []).includes(followingUserId) || (target.blocked || []).includes(userId)){
        throw createError(403, "Cannot follow a user involved in a block")
    }

    // Decide follow vs unfollow from current membership, then issue a SINGLE
    // atomic update. We never read-modify-.save() the array: $addToSet refuses
    // duplicates by definition and $pull removes every occurrence, so concurrent
    // or repeated follows can't inflate the count with duplicate ids.
    const alreadyFollowing = user.following.includes(followingUserId);

    if(alreadyFollowing){
        await User.updateOne({ _id: userId }, { $pull: { following: followingUserId } });
    }
    else{
        const res = await User.updateOne({ _id: userId }, { $addToSet: { following: followingUserId } });
        // Only notify on a REAL new follow — i.e. the id was actually added.
        // A no-op $addToSet (already present) reports modifiedCount 0 and stays silent.
        if(res.modifiedCount > 0){
            // target already loaded above; gate on recipient's follows pref.
            const followsEnabled = target.notificationPrefs?.follows !== false;
            if(followsEnabled){
                await new Notification({actionType: 'follow', fromUser: userId, toUser: followingUserId}).save()
            }
        }
    }

    const saveFollow = await User.findById(userId);
    return pickSafeUserFields(saveFollow);
}

// Toggle a block on another user. Blocking also tears down any follow
// relationship in BOTH directions so neither user follows the other afterwards.
// Enforcement of the block (hidden lists/profile, no messaging, no follow) lives
// in getUsers / getUser / followUser / chat getOrCreateConversation.
const blockUser = async (blockerId, targetId) => {
    if(blockerId === targetId) throw createError(400, "Cannot block yourself")

    const blocker = await User.findById(blockerId);
    if(!blocker) throw createError(404, "User not found")
    const target = await User.findById(targetId);
    if(!target) throw createError(404, "User not found")

    const alreadyBlocked = (blocker.blocked || []).includes(targetId);
    if(alreadyBlocked){
        await User.updateOne({ _id: blockerId }, { $pull: { blocked: targetId } });
    } else {
        await User.updateOne(
            { _id: blockerId },
            { $addToSet: { blocked: targetId }, $pull: { following: targetId } }
        );
        await User.updateOne({ _id: targetId }, { $pull: { following: blockerId } });
    }

    const updated = await User.findById(blockerId);
    return pickSafeUserFields(updated);
}

const deleteUser = async (deletedUserId) => {
    const deleted = await User.findByIdAndDelete(deletedUserId);
    if(!deleted) throw createError(404, "Delete user not possible")

    await Card.deleteMany(
        {userId: deletedUserId},
    )

    await Card.updateMany(
        {likes: deletedUserId},
        {$pull: {likes: deletedUserId}}
    )

    await Card.updateMany(
        {'comments.userId': deletedUserId},
        {$pull: {comments: {userId: deletedUserId}}}
    )

    await User.updateMany(
        {following: deletedUserId},
        {$pull: {following: deletedUserId}}
    )

    return pickSafeUserFields(deleted)
} 

const banUser = async(bannedUserId) => {

    let bannedUser = await User.findById(bannedUserId)
    if(!bannedUser) throw createError(404, "user not found");

    bannedUser.isBanned = !bannedUser.isBanned

    const updatedBannedUser = await bannedUser.save();

    // When a user is banned, clean up follow references the same way deleteUser
    // does — pull their id out of everyone's `following` array so a banned user
    // stops inflating follower/following counts. (No-op on unban: by then their
    // id has already been pulled, so there is nothing to remove.)
    if(updatedBannedUser.isBanned){
        await User.updateMany(
            {following: bannedUserId},
            {$pull: {following: bannedUserId}}
        )
    }

    return pickSafeUserFields(updatedBannedUser)
}

const promoteUserToAdmin = async (promotedUserId) => {
    let promotedUser = await User.findById(promotedUserId)
    if(!promotedUser) throw createError(404, "user not found")

    promotedUser.isAdmin = !promotedUser.isAdmin;

    const updatedPromotedUser = await promotedUser.save()
    return pickSafeUserFields(updatedPromotedUser)
}

// PATCH /users/me/onboarding — update onboardingComplete and/or interests for the
// calling user only. Validates that all interest entries are strings.
const updateOnboarding = async (userId, { interests, onboardingComplete } = {}) => {
    if (interests !== undefined) {
        if (!Array.isArray(interests)) throw createError(400, 'interests must be an array');
        if (!interests.every(i => typeof i === 'string')) {
            throw createError(400, 'each interest must be a string');
        }
    }

    const update = {};
    if (interests !== undefined) update.interests = interests;
    if (onboardingComplete !== undefined) update.onboardingComplete = !!onboardingComplete;

    if (Object.keys(update).length === 0) throw createError(400, 'No fields to update');

    const updated = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!updated) throw createError(404, 'User not found');
    return pickSafeUserFields(updated);
};

// GET /users/suggested — real users to follow, block-aware both directions.
// Order: friends-of-friends (users followed by people I follow) first, then by
// follower count desc. Offset-based cursor so pages are stable in the context of
// a single open session (encoded as base64 of the skip offset).
const getSuggestedUsers = async (requesterId, opts = {}) => {
    const me = await User.findById(requesterId);
    if (!me) throw createError(404, 'User not found');

    const lim = Math.min(Math.max(Number(opts.limit) || 10, 1), 50);
    const skip = opts.cursor
        ? parseInt(Buffer.from(opts.cursor, 'base64').toString('utf8'), 10) || 0
        : 0;

    const myIdStr = String(requesterId);
    const blockedByMe = (me.blocked || []).map(String);
    const myFollowing = (me.following || []).map(String);

    // Users who blocked the requester (using the blocked index)
    const blockedMeDocs = await User.find({ blocked: requesterId }, '_id');
    const blockedMe = blockedMeDocs.map(u => String(u._id));

    // Build full exclusion set: self + already-following + blocked-either-way
    const excludeStrs = new Set([myIdStr, ...myFollowing, ...blockedByMe, ...blockedMe]);

    // Friends-of-friends: users followed by anyone the requester follows,
    // excluding already-excluded ids.
    const fofSet = new Set();
    if (myFollowing.length) {
        const followedUsers = await User.find({ _id: { $in: myFollowing } }, 'following');
        for (const f of followedUsers) {
            for (const id of (f.following || [])) {
                const s = String(id);
                if (!excludeStrs.has(s)) fofSet.add(s);
            }
        }
    }

    // Fetch all candidate users (not excluded). No follower count yet.
    const excludeArr = [...excludeStrs];
    const candidates = await User.find(
        { _id: { $nin: excludeArr }, blocked: { $ne: requesterId } },
        '_id name lastName job profilePicture'
    );

    if (!candidates.length) return { users: [], nextCursor: null };

    // Compute follower counts for all candidates in ONE aggregation query.
    // A user's follower count = number of other users whose `following` array
    // contains their id.  `following` is a [String] array.
    const candidateIdStrs = candidates.map(u => String(u._id));
    const followerAgg = await User.aggregate([
        { $match: { following: { $in: candidateIdStrs } } },
        { $unwind: '$following' },
        { $match: { following: { $in: candidateIdStrs } } },
        { $group: { _id: '$following', count: { $sum: 1 } } },
    ]);
    const followerCountMap = {};
    for (const row of followerAgg) {
        followerCountMap[String(row._id)] = row.count;
    }

    // Build result list with computed fields, then sort deterministically.
    const sorted = candidates
        .map(u => {
            const idStr = String(u._id);
            return {
                _id: u._id,
                name: u.name,
                lastName: u.lastName,
                job: u.job,
                profilePicture: u.profilePicture,
                followersCount: followerCountMap[idStr] || 0,
                isFollowing: false, // all candidates are already excluded from myFollowing
                _isFoF: fofSet.has(idStr) ? 1 : 0,
                _idStr: idStr,
            };
        })
        .sort((a, b) => {
            if (b._isFoF !== a._isFoF) return b._isFoF - a._isFoF;
            if (b.followersCount !== a.followersCount) return b.followersCount - a.followersCount;
            // Tiebreak by _id string (deterministic, avoids random ordering)
            return b._idStr.localeCompare(a._idStr);
        });

    // Apply cursor (offset-based)
    const page = sorted.slice(skip, skip + lim);
    const hasMore = sorted.length > skip + lim;
    const nextCursor = hasMore
        ? Buffer.from(String(skip + lim)).toString('base64')
        : null;

    return {
        users: page.map(({ _isFoF, _idStr, ...u }) => u),
        nextCursor,
    };
};

// Allowlist of toggleable per-type notification preference keys. Any unknown
// key in the request body is rejected so clients can't sneak in arbitrary
// fields.
const NOTIF_PREF_KEYS = new Set(['likes', 'comments', 'follows', 'commentLikes', 'commentReplies']);

// PATCH /users/me/notification-prefs — update one or more per-type booleans for
// the calling user only. Rejects unknown keys and non-boolean values.
const updateNotificationPrefs = async (userId, prefs) => {
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
        throw createError(400, 'Request body must be an object');
    }
    const update = {};
    for (const [key, val] of Object.entries(prefs)) {
        if (!NOTIF_PREF_KEYS.has(key)) throw createError(400, `Unknown preference key: ${key}`);
        if (typeof val !== 'boolean') throw createError(400, `Value for "${key}" must be a boolean`);
        update[`notificationPrefs.${key}`] = val;
    }
    if (Object.keys(update).length === 0) throw createError(400, 'No preference fields provided');
    const updated = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!updated) throw createError(404, 'User not found');
    return pickSafeUserFields(updated);
};

module.exports = {
    createNewUser,
    getUsers,
    getUser,
    getBlockedUsers,
    updateUser,
    deleteUser,
    loginUser,
    pickSafeUserFields,
    followUser,
    blockUser,
    // cardsFeed,
    banUser,
    promoteUserToAdmin,
    updateOnboarding,
    getSuggestedUsers,
    updateNotificationPrefs,
};