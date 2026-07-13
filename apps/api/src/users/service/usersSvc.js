const mongoose = require('mongoose');
const User = require('../models/User');
const _ = require('lodash');
const {generateUserPassword, comparePassword} = require('../helpers/bcrypt');
const {signNewToken} = require('../../auth/providers/jwt');
const {issueRefreshToken} = require('../../auth/refreshTokens');
const { createError } = require('../../utils/handleErrors');
const normalizeUser = require('../helpers/normalizeUser');
const Card = require('../../cards/models/Card');
const Notification = require('../../notifications/models/Notifications');
const { normalizeLimit, decodeCursor, runKeysetPage } = require('../../utils/cursorPagination');
 
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
        "favorites",
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
// `extra.followersCount` and `extra.postsCount` (when the caller has computed
// them) are attached so counts are server-authoritative instead of derived
// client-side from a fully-loaded user list. `followingCount` is always
// computable from the doc itself (the deduped size of `following`), so it's
// attached unconditionally.
const projectUser = (user, requesterId, isAdmin, extra = {}) => {
    const isSelf = requesterId && String(user._id) === String(requesterId);
    const base = (isAdmin || isSelf) ? pickSafeUserFields(user) : pickPublicUserFields(user);
    base.followingCount = new Set((user.following || []).map(String)).size;
    if (extra.followersCount !== undefined) base.followersCount = extra.followersCount;
    if (extra.postsCount !== undefined) base.postsCount = extra.postsCount;
    return base;
}

// Followers of a user = other users whose `following` array contains their id
// (there is no stored `followers` array). One aggregation counts followers for a
// whole set of ids at once — no N+1 when projecting a list.
const countFollowersFor = async (userIds) => {
    const ids = userIds.map(String);
    if (!ids.length) return {};
    const rows = await User.aggregate([
        { $match: { following: { $in: ids } } },
        { $unwind: '$following' },
        { $match: { following: { $in: ids } } },
        { $group: { _id: '$following', count: { $sum: 1 } } },
    ]);
    const map = {};
    for (const row of rows) map[String(row._id)] = row.count;
    return map;
}

// The logged-in user's OWN counts, attached at the auth entry points (register,
// login, token refresh). Without these the own-profile sidebar/dashboard has no
// source for "N posts / N followers" except deriving them from a fully-loaded
// users/cards array — the very thing we're retiring.
//
// Deliberately NOT folded into pickSafeUserFields: that helper is synchronous and
// also serializes every mutation response (follow, edit, ban, promote, ...), so
// making it async would put two extra queries on writes that never render a count.
// Same semantics as GET /users/:id, so the numbers agree across surfaces.
const attachOwnCounts = async (safeUser) => {
    const id = String(safeUser._id);
    const [followersCount, postsCount] = await Promise.all([
        User.countDocuments({ following: id }),
        Card.countDocuments({ userId: id, status: 'active' }),
    ]);
    return {
        ...safeUser,
        followersCount,
        postsCount,
        followingCount: new Set((safeUser.following || []).map(String)).size,
    };
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
        const safeUser = await attachOwnCounts(pickSafeUserFields(newUser));
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
        const safeUser = await attachOwnCounts(pickSafeUserFields(user));
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
        const userIds = users.map(u => u._id);
        const followerMap = await countFollowersFor(userIds);

        // One aggregation for active post counts — no N+1.
        const postsAgg = await Card.aggregate([
            { $match: { status: 'active', userId: { $in: userIds } } },
            { $group: { _id: '$userId', n: { $sum: 1 } } },
        ]);
        const postsMap = {};
        for (const row of postsAgg) postsMap[String(row._id)] = row.n;

        return users.map(user => projectUser(user, requesterId, isAdmin, {
            followersCount: followerMap[String(user._id)] || 0,
            postsCount: postsMap[String(user._id)] || 0,
        }))
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
        const [followersCount, postsCount] = await Promise.all([
            User.countDocuments({ following: String(userId) }),
            Card.countDocuments({ userId, status: 'active' }),
        ]);
        return projectUser(user, requesterId, isAdmin, { followersCount, postsCount })
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

// Bookmark a card for the calling user. Atomic $addToSet so repeat calls never
// duplicate. Rejects an invalid id (400) or a card that isn't a real, active
// post (404) — you can't save a banned/deleted/nonexistent post. Returns the
// updated favorites id list so the client can reconcile.
const addFavorite = async (userId, cardId) => {
    if(!mongoose.isValidObjectId(cardId)) throw createError(400, 'Invalid post');
    const card = await Card.findById(cardId);
    if(!card || card.status !== 'active') throw createError(404, 'Post not found');
    await User.updateOne({ _id: userId }, { $addToSet: { favorites: cardId } });
    const user = await User.findById(userId);
    return { favorites: (user.favorites || []).map(String) };
}

// Remove a bookmark. $pull is idempotent (removing an absent id is a no-op) and
// intentionally does NOT require the card to still exist/be active, so a user can
// always unsave a post that was since banned or deleted.
const removeFavorite = async (userId, cardId) => {
    if(!mongoose.isValidObjectId(cardId)) throw createError(400, 'Invalid post');
    await User.updateOne({ _id: userId }, { $pull: { favorites: cardId } });
    const user = await User.findById(userId);
    return { favorites: (user.favorites || []).map(String) };
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

// GET /users/browse — cursor-paginated list of all users, newest-first (keyset).
// Block-aware both directions: mirrors the getUsers filter pattern so hidden users
// are never surfaced. Returns { items, nextCursor }.
const getUsersPage = async (requesterId, isAdmin, opts = {}) => {
    const pageSize = normalizeLimit(opts.limit);
    let decoded = null;
    if (opts.cursor) {
        decoded = decodeCursor(opts.cursor);
        if (!decoded) throw createError(400, 'Invalid cursor');
    }

    const baseFilter = {};
    if (requesterId) {
        const requester = await User.findById(requesterId);
        const blockedByMe = requester?.blocked || [];
        baseFilter._id = { $nin: blockedByMe };
        baseFilter.blocked = { $ne: requesterId };
    }

    const { page, nextCursor } = await runKeysetPage(User, baseFilter, decoded, pageSize);
    const items = page.map(user => projectUser(user, requesterId, isAdmin));

    return { items, nextCursor };
};

// Helper: verify a target profile is accessible to the requester (mirrors getUser
// block logic). Returns [target, requester] docs for reuse by the caller.
const _resolveProfileAccess = async (targetId, requesterId) => {
    const [target, requester] = await Promise.all([
        User.findById(targetId),
        requesterId ? User.findById(requesterId) : Promise.resolve(null),
    ]);
    if (!target) throw createError(404, 'User not found');
    if (requester && String(targetId) !== String(requesterId)) {
        const iBlocked = (requester.blocked || []).map(String).includes(String(targetId));
        const theyBlocked = (target.blocked || []).map(String).includes(String(requesterId));
        if (iBlocked || theyBlocked) throw createError(404, 'User not found');
    }
    return { target, requester };
};

// GET /users/:id/followers — paginated list of users who follow the target.
// If the target profile is hidden from the requester (blocked either way) → 404.
// Block-aware relative to the REQUESTER: hidden-either-way users are excluded.
const getFollowers = async (targetId, requesterId, isAdmin, opts = {}) => {
    const { requester } = await _resolveProfileAccess(targetId, requesterId);

    const pageSize = normalizeLimit(opts.limit);
    let decoded = null;
    if (opts.cursor) {
        decoded = decodeCursor(opts.cursor);
        if (!decoded) throw createError(400, 'Invalid cursor');
    }

    // Followers = users whose `following` array contains targetId
    const baseFilter = { following: String(targetId) };
    if (requester) {
        baseFilter._id = { $nin: requester.blocked || [] };
        baseFilter.blocked = { $ne: requesterId };
    }

    const { page, nextCursor } = await runKeysetPage(User, baseFilter, decoded, pageSize);
    const items = page.map(user => projectUser(user, requesterId, isAdmin));

    return { items, nextCursor };
};

// GET /users/:id/following — paginated list of users the target follows.
// If the target profile is hidden from the requester (blocked either way) → 404.
// Block-aware relative to the REQUESTER: hidden-either-way users are excluded.
const getFollowing = async (targetId, requesterId, isAdmin, opts = {}) => {
    const { target, requester } = await _resolveProfileAccess(targetId, requesterId);

    const pageSize = normalizeLimit(opts.limit);
    let decoded = null;
    if (opts.cursor) {
        decoded = decodeCursor(opts.cursor);
        if (!decoded) throw createError(400, 'Invalid cursor');
    }

    const allFollowingIds = (target.following || []).map(String);
    if (!allFollowingIds.length) return { items: [], nextCursor: null };

    // Filter out users blocked by the requester from the following list
    const blockedByMe = requester ? (requester.blocked || []).map(String) : [];
    const visibleIds = allFollowingIds.filter(id => !blockedByMe.includes(id));
    if (!visibleIds.length) return { items: [], nextCursor: null };

    const baseFilter = {
        _id: { $in: visibleIds },
        // Exclude users who blocked the requester
        ...(requesterId ? { blocked: { $ne: requesterId } } : {}),
    };

    const { page, nextCursor } = await runKeysetPage(User, baseFilter, decoded, pageSize);
    const items = page.map(user => projectUser(user, requesterId, isAdmin));

    return { items, nextCursor };
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

// GET /users/search — OFFSET-cursor-paginated user search with filters and sort.
// Block-aware both directions (same filter as getUsers). Returns { items, nextCursor }.
const getUsersSearch = async (requesterId, isAdmin, opts = {}) => {
    const { search, gender, countries, sort, cursor, limit } = opts;

    // Block filter: same as getUsers
    const baseFilter = {};
    if (requesterId) {
        const requester = await User.findById(requesterId);
        if (!requester) throw createError(404, 'User not found');
        const blockedByMe = requester.blocked || [];
        baseFilter._id = { $nin: blockedByMe };
        baseFilter.blocked = { $ne: requesterId };
    }

    // Search: case-insensitive SUBSTRING match on `name` only
    if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), 'i');
        baseFilter.name = rx;
    }

    // Gender: exact equality
    if (gender && gender.trim()) {
        baseFilter.gender = gender.trim();
    }

    // Countries: comma-separated list, case-insensitive match against address.country
    if (countries && countries.trim()) {
        const countryList = countries.split(',').map(c => c.trim()).filter(Boolean);
        if (countryList.length) {
            baseFilter['address.country'] = {
                $in: countryList.map(c => new RegExp('^' + escapeRegex(c) + '$', 'i')),
            };
        }
    }

    // OFFSET pagination
    const lim = normalizeLimit(limit);
    let skip = 0;
    if (cursor) {
        const raw = parseInt(Buffer.from(String(cursor), 'base64').toString('utf8'), 10);
        if (!Number.isFinite(raw) || raw < 0) throw createError(400, 'Invalid cursor');
        skip = raw;
    }

    // Sort
    let sortObj;
    switch (sort) {
        case 'youngest': sortObj = { age: 1, _id: 1 }; break;
        case 'oldest':   sortObj = { age: -1, _id: -1 }; break;
        case 'az':       sortObj = { name: 1, _id: 1 }; break;
        case 'za':       sortObj = { name: -1, _id: -1 }; break;
        default:         sortObj = { createdAt: -1, _id: -1 }; break;
    }

    const rows = await User.find(baseFilter).sort(sortObj).skip(skip).limit(lim + 1);
    const hasMore = rows.length > lim;
    const page = hasMore ? rows.slice(0, lim) : rows;
    const nextCursor = hasMore
        ? Buffer.from(String(skip + lim)).toString('base64')
        : null;

    // Embed active post counts server-side (one aggregation over the page, no
    // N+1) so the browse grid shows real counts without scanning a global cards
    // array — same as getUsers.
    const pageIds = page.map(u => u._id);
    const postsAgg = await Card.aggregate([
        { $match: { status: 'active', userId: { $in: pageIds } } },
        { $group: { _id: '$userId', n: { $sum: 1 } } },
    ]);
    const postsMap = {};
    for (const row of postsAgg) postsMap[String(row._id)] = row.n;

    return {
        items: page.map(user => projectUser(user, requesterId, isAdmin, {
            postsCount: postsMap[String(user._id)] || 0,
        })),
        nextCursor,
    };
};

// GET /users/admin — offset-paginated admin view of ALL users with server-side
// search, filter, and sort. Admin-only — caller must verify isAdmin before calling.
// Opts: { page (1-based), limit, search (name/lastName), gender, country,
//         role ('admin'|'user'|''), sort }.
// Sort keys: joined (createdAt desc, default), joined_asc, name_asc, name_desc,
//            age (youngest first), age_desc, posts, posts_asc, followers, followers_asc.
// Returns { items, total, page, limit }. Items include followersCount and postsCount.
const getAdminUsers = async (currentUserId, opts = {}) => {
    const { page: rawPage, limit: rawLimit, search, gender, country, role, sort } = opts;
    const pageNum = Math.max(1, parseInt(rawPage, 10) || 1);
    const lim = normalizeLimit(rawLimit, 10, 100);
    const skip = (pageNum - 1) * lim;

    // ── Match filter ─────────────────────────────────────────────────────────
    const matchStage = {};
    if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), 'i');
        matchStage.$or = [{ name: rx }, { lastName: rx }];
    }
    if (gender && gender.trim()) {
        matchStage.gender = gender.trim();
    }
    if (country && country.trim()) {
        matchStage['address.country'] = new RegExp('^' + escapeRegex(country.trim()) + '$', 'i');
    }
    if (role === 'admin') matchStage.isAdmin = true;
    if (role === 'user') matchStage.isAdmin = { $ne: true };

    // ── Sort ─────────────────────────────────────────────────────────────────
    let sortStage;
    switch (sort) {
        case 'joined_asc':    sortStage = { createdAt: 1,  _id: 1  };                  break;
        case 'name_asc':      sortStage = { name: 1,  lastName: 1,  _id: 1  };         break;
        case 'name_desc':     sortStage = { name: -1, lastName: -1, _id: -1 };         break;
        case 'age':           sortStage = { age: 1,  _id: 1  };                        break;
        case 'age_desc':      sortStage = { age: -1, _id: -1 };                        break;
        case 'posts':         sortStage = { postsCount: -1, _id: -1 };                 break;
        case 'posts_asc':     sortStage = { postsCount: 1,  _id: 1  };                 break;
        case 'followers':     sortStage = { followersCount: -1, _id: -1 };             break;
        case 'followers_asc': sortStage = { followersCount: 1,  _id: 1  };             break;
        case 'joined':
        default:              sortStage = { createdAt: -1, _id: -1 };                  break;
    }

    const pipeline = [
        { $match: matchStage },

        // followersCount: users whose `following` string-array contains this user's _id
        {
            $lookup: {
                from: 'users',
                let: { uid: { $toString: '$_id' } },
                pipeline: [
                    { $match: { $expr: { $in: ['$$uid', '$following'] } } },
                    { $count: 'n' },
                ],
                as: '_followersArr',
            },
        },
        {
            $addFields: {
                followersCount: { $ifNull: [{ $arrayElemAt: ['$_followersArr.n', 0] }, 0] },
            },
        },

        // postsCount: cards authored by this user
        {
            $lookup: {
                from: 'cards',
                let: { uid: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$userId', '$$uid'] } } },
                    { $count: 'n' },
                ],
                as: '_postsArr',
            },
        },
        {
            $addFields: {
                postsCount: { $ifNull: [{ $arrayElemAt: ['$_postsArr.n', 0] }, 0] },
            },
        },

        {
            $facet: {
                items: [
                    { $sort: sortStage },
                    { $skip: skip },
                    { $limit: lim },
                    {
                        $project: {
                            name: 1, lastName: 1, email: 1, gender: 1,
                            profilePicture: 1, address: 1, age: 1,
                            isAdmin: 1, isBanned: 1,
                            createdAt: 1, lastLoginAt: 1,
                            followersCount: 1, postsCount: 1,
                        },
                    },
                ],
                total: [{ $count: 'n' }],
            },
        },
    ];

    const [result] = await User.aggregate(pipeline);
    return {
        items: result.items ?? [],
        total: result.total[0]?.n ?? 0,
        page: pageNum,
        limit: lim,
    };
};

// GET /users/countries — sorted distinct list of address.country values visible
// to the requester (block-aware both directions). Non-empty values only.
const getUserCountriesList = async (requesterId) => {
    const filter = { 'address.country': { $nin: [null, ''] } };
    if (requesterId) {
        const requester = await User.findById(requesterId);
        if (!requester) throw createError(404, 'User not found');
        const blockedByMe = requester.blocked || [];
        filter._id = { $nin: blockedByMe };
        filter.blocked = { $ne: requesterId };
    }
    const raw = await User.distinct('address.country', filter);
    const sorted = raw
        .filter(c => typeof c === 'string' && c.trim())
        .sort((a, b) => a.localeCompare(b));
    return { countries: sorted };
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
    attachOwnCounts,
    followUser,
    blockUser,
    addFavorite,
    removeFavorite,
    // cardsFeed,
    banUser,
    promoteUserToAdmin,
    updateOnboarding,
    getSuggestedUsers,
    updateNotificationPrefs,
    getUsersPage,
    getFollowers,
    getFollowing,
    getUsersSearch,
    getUserCountriesList,
    getAdminUsers,
};