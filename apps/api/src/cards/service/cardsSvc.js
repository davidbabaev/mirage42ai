const mongoose = require('mongoose');
const User = require('../../users/models/User');
const { createError } = require('../../utils/handleErrors');
const normalizeCard = require('../helpers/normalizeCard');
const Card = require('../models/Card')
const Notification = require('../../notifications/models/Notifications');
const { normalizeLimit, decodeCursor, encodeCursor, runKeysetPage } = require('../../utils/cursorPagination');
const _ = require('lodash');

// Escape user input before using it in a RegExp so a search term can't inject
// regex metacharacters (ReDoS / unintended matches).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Ids whose content the requester must not see: users they blocked AND users
// who blocked them (block is enforced both directions, like getUsers). Empty
// for a logged-out requester.
const getHiddenUserIds = async (requesterId) => {
    if(!requesterId) return new Set();
    const me = await User.findById(requesterId);
    const iBlocked = (me?.blocked || []).map(String);
    const blockedMe = await User.find({ blocked: requesterId }, '_id');
    return new Set([...iBlocked, ...blockedMe.map(u => String(u._id))]);
}

// Drop comments (and replies) authored by a hidden user from a plain card object,
// so a blocked user's comments never surface to the requester.
const stripBlockedComments = (cardObj, hiddenSet) => {
    if(!hiddenSet.size || !cardObj.comments) return cardObj;
    cardObj.comments = cardObj.comments
        .filter(c => !hiddenSet.has(String(c.userId)))
        .map(c => ({
            ...c,
            replies: (c.replies || []).filter(r => !hiddenSet.has(String(r.userId))),
        }));
    return cardObj;
}

// True if a block exists in EITHER direction between two users — one indexed
// lookup against the `blocked` array (see User index). Used to reject writes
// across a block and to suppress notifications to/from a blocked user. A read
// already 404s the card; this closes the matching hole on the write/notify side.
const blockExistsBetween = async (aId, bId) => {
    if(!aId || !bId || String(aId) === String(bId)) return false;
    const hit = await User.findOne({
        $or: [
            { _id: aId, blocked: String(bId) },
            { _id: bId, blocked: String(aId) },
        ],
    }, '_id');
    return !!hit;
}

const pickSafeCardFields = (card) => {
    // Accept both Mongoose documents (.toObject()) and plain aggregation results.
    const obj = typeof card.toObject === 'function' ? card.toObject() : card;
    return _.pick(obj, [
        "title",
        "content",
        "web",
        "mediaUrl",
        "mediaType",
        "location",
        "category",
        "likes",
        "comments",
        "createdAt",
        "_id",
        "userId",
        "status",
        "reportCount"
    ]);
}

const createNewCard = async (card, userId) => {
    try{
        card = normalizeCard(card) // fill defaults
        let newCard = new Card({...card, userId})
        newCard = await newCard.save();
        // return newCard;
        return pickSafeCardFields(newCard)
    }
    catch(err){
        throw err;
    }
}

const getCards = async (requesterId, isAdmin) => {
        const hidden = await getHiddenUserIds(requesterId);
        const filter = isAdmin ? {} : {status: 'active'}
        // Hide posts authored by a blocked user (either direction).
        if(hidden.size) filter.userId = { $nin: [...hidden] };
        const cards = await Card.find(filter)
        const mapped = cards.map(card => stripBlockedComments(pickSafeCardFields(card), hidden));
        return enrichCards(mapped);
}

// The caller's saved posts, hydrated fresh from the DB (so edits/bans reflect,
// unlike the old localStorage snapshots). Non-admins see only still-active posts
// and never a blocked author's post; comments from blocked users are stripped.
// Returned in the user's save order (their favorites array order).
const getFavoriteCards = async (userId, requesterId, isAdmin) => {
        const user = await User.findById(userId);
        if(!user) throw createError(401, 'User not found');
        const favoriteIds = (user.favorites || []).map(String);
        if(!favoriteIds.length) return [];

        const hidden = await getHiddenUserIds(requesterId);
        const filter = { _id: { $in: favoriteIds } };
        if(!isAdmin) filter.status = 'active';
        if(hidden.size) filter.userId = { $nin: [...hidden] };

        const cards = await Card.find(filter);
        const order = new Map(favoriteIds.map((id, i) => [id, i]));
        cards.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
        const mapped = cards.map(card => stripBlockedComments(pickSafeCardFields(card), hidden));
        return enrichCards(mapped);
}

// Raw fetch for internal/owner operations (edit, delete, like, comment):
// returns the Mongoose doc regardless of status.
const getCard = async (cardId) => {
        const card = await Card.findById(cardId)
        if(!card) throw createError(404, "Card not found")
        return card;
}

// Public-facing single-card read: banned/deleted cards are invisible to
// non-admins (server-side, where the ban is real). Admins see everything.
const getPublicCard = async (cardId, requesterId, isAdmin) => {
        const card = await Card.findById(cardId)
        if(!card) throw createError(404, "Card not found")
        if(!isAdmin && card.status !== 'active') throw createError(404, "Card not found")
        // A blocked author's post is invisible to the requester (either direction).
        const hidden = await getHiddenUserIds(requesterId);
        if(hidden.has(String(card.userId))) throw createError(404, "Card not found")
        return enrichCard(stripBlockedComments(pickSafeCardFields(card), hidden));
}

const updateCard = async (cardId, upCard) => {
        let updatedCard = await Card.findByIdAndUpdate(cardId, upCard, {new: true});
        if(!updatedCard) throw createError(404, "Cannot update card ");
        return updatedCard;
}

const deleteCard = async (cardId) => {
        const deletedCard = await Card.findByIdAndDelete(cardId);
        if(!deletedCard) throw createError(404, "Cannot delete card")
        return deletedCard;
}

const likeCard = async (cardById, userId) => {
    // 1. find the card by id
    const card = await Card.findById(cardById);
    if(!card) throw createError(404, "Card not found")

    // No interacting across a block (either direction) — the card is already
    // invisible to a blocked viewer on read; reject the write to match.
    if(await blockExistsBetween(userId, card.userId)) throw createError(403, "Action not allowed")

    // 2. check and change likes
    if(card.likes.includes(userId)){
        card.likes = card.likes.filter(id => id !== userId)
    }
    else{
        card.likes.push(userId);
        if(userId !== card.userId.toString()){
            // Gate on recipient's per-type pref. One targeted read with projection.
            const recipient = await User.findById(card.userId, 'notificationPrefs').lean();
            if(recipient?.notificationPrefs?.likes !== false){
                await new Notification({actionType: 'like',fromUser: userId, toUser: card.userId, whichCard: card._id}).save();
            }
        }
    }
    // 3. save after changes
    const savedCard = await card.save();

    // 4. return
    return enrichCard(pickSafeCardFields(savedCard));
}

// Toggle a like on an embedded comment. Mirrors likeCard: same string-array
// toggle and the same fire-once notification — but the recipient is the COMMENT
// author (not the card owner), and self-likes don't notify.
const likeComment = async (cardId, commentId, userId) => {
    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    // Reject the write across a block with the post owner.
    if(await blockExistsBetween(userId, card.userId)) throw createError(403, "Action not allowed")

    const comment = card.comments.id(commentId);
    if(!comment) throw createError(404, "Comment not found")

    if(comment.likes.includes(userId)){
        comment.likes = comment.likes.filter(id => id !== userId)
    }
    else{
        comment.likes.push(userId);
        // The recipient is the COMMENT author, who may be a third party — guard
        // the notification against a block between actor and comment author.
        if(userId !== comment.userId.toString() && !(await blockExistsBetween(userId, comment.userId))){
            const recipient = await User.findById(comment.userId, 'notificationPrefs').lean();
            if(recipient?.notificationPrefs?.commentLikes !== false){
                await new Notification({actionType: 'comment-like', fromUser: userId, toUser: comment.userId, whichCard: card._id, commentId: comment._id}).save();
            }
        }
    }

    const savedCard = await card.save();
    return enrichCard(pickSafeCardFields(savedCard));
}

const addComment = async (cardId, userId, commentText) => {
    // find the card by ID
    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    if(await blockExistsBetween(userId, card.userId)) throw createError(403, "Action not allowed")

    card.comments.push({userId, commentText})

    if(userId !== card.userId.toString()){
        const recipient = await User.findById(card.userId, 'notificationPrefs').lean();
        if(recipient?.notificationPrefs?.comments !== false){
            await new Notification({actionType: 'comment',fromUser: userId, toUser: card.userId, whichCard: card._id}).save()
        }
    }

    // save after changes
    const saveComment = await card.save();
    // return picked with comment authors embedded
    return enrichCard(pickSafeCardFields(saveComment));
}

// Add a single-level reply to an embedded comment. Mirrors addComment, but the
// reply lives under the parent comment and the notification (comment-reply)
// goes to the COMMENT author, not the card owner. Self-replies don't notify.
const addReply = async (cardId, commentId, userId, replyText) => {
    if(!replyText || !replyText.trim()) throw createError(400, "Reply text is required")

    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    if(await blockExistsBetween(userId, card.userId)) throw createError(403, "Action not allowed")

    const comment = card.comments.id(commentId);
    if(!comment) throw createError(404, "Comment not found")

    comment.replies.push({userId, replyText: replyText.trim()})

    // Recipient is the COMMENT author (possibly a third party) — suppress the
    // notification if a block exists between actor and comment author.
    if(userId !== comment.userId.toString() && !(await blockExistsBetween(userId, comment.userId))){
        const recipient = await User.findById(comment.userId, 'notificationPrefs').lean();
        if(recipient?.notificationPrefs?.commentReplies !== false){
            await new Notification({actionType: 'comment-reply', fromUser: userId, toUser: comment.userId, whichCard: card._id, commentId: comment._id}).save()
        }
    }

    const savedCard = await card.save();
    return enrichCard(pickSafeCardFields(savedCard));
}

const removeComment = async (cardId, commentId) => {
    const card = await Card.findById(cardId);
    if(!card) throw createError(404, "Card not found")

    card.comments = card.comments.filter(comment => comment._id.toString() !== commentId)

    const saveComment = await card.save();
    return enrichCard(pickSafeCardFields(saveComment));
}

// Attach a `likePreview` array (first n liker objects) to each plain card object
// so feed cards carry avatar data without scanning the global users array.
// One User.find for the union of the first-n like-ids across the whole page
// (no N+1). Cards are already plain JS objects at this point (pickSafeCardFields
// already called toObject + _.pick), so we spread rather than mutate.
const attachLikePreview = async (cards, n = 4) => {
    // Collect the first n like-ids from each card, deduped across all cards.
    const idSet = new Set();
    for (const card of cards) {
        for (const id of (card.likes || []).slice(0, n)) {
            idSet.add(String(id));
        }
    }

    if (!idSet.size) {
        return cards.map(card => ({ ...card, likePreview: [] }));
    }

    const likers = await User.find(
        { _id: { $in: [...idSet] } },
        'name lastName profilePicture'
    ).lean();

    const byId = new Map(likers.map(u => [String(u._id), u]));

    return cards.map(card => {
        const preview = (card.likes || [])
            .slice(0, n)
            .map(id => byId.get(String(id)))
            .filter(Boolean)
            .map(u => ({
                _id: u._id,
                name: u.name,
                lastName: u.lastName,
                profilePicture: u.profilePicture || '',
            }));
        return { ...card, likePreview: preview };
    });
};

// ── Comment-author embed helpers ─────────────────────────────────────────────
// Attach an `author` sub-object to every comment and reply so the client renders
// commenter names/avatars without scanning a global users array. One User.find
// for the union of all userIds across the whole batch (no N+1).
//
// All three public wrappers share the same two private primitives below:
//   _buildCommentAuthorMap — collect ids → one User.find → byId Map
//   _decorateCommentList   — walk comments/replies, stamp author or null

const _buildCommentAuthorMap = async (comments) => {
    const idSet = new Set();
    for (const c of comments) {
        if (c.userId) idSet.add(String(c.userId));
        for (const r of (c.replies || [])) {
            if (r.userId) idSet.add(String(r.userId));
        }
    }
    if (!idSet.size) return new Map();
    const users = await User.find(
        { _id: { $in: [...idSet] } },
        'name lastName profilePicture job'
    ).lean();
    return new Map(users.map(u => [String(u._id), u]));
};

const _decorateCommentList = (comments, byId) =>
    (comments || []).map(c => {
        const u = byId.get(String(c.userId));
        return {
            ...c,
            author: u
                ? { _id: u._id, name: u.name, lastName: u.lastName, profilePicture: u.profilePicture || '', job: u.job || '' }
                : null,
            replies: (c.replies || []).map(r => {
                const ru = byId.get(String(r.userId));
                return {
                    ...r,
                    author: ru
                        ? { _id: ru._id, name: ru.name, lastName: ru.lastName, profilePicture: ru.profilePicture || '' }
                        : null,
                };
            }),
        };
    });

// Public: enrich an array of plain card objects (post-pickSafeCardFields + stripBlockedComments).
// Collects comment/reply userIds across ALL cards in one Set → one User.find.
const attachCommentAuthors = async (cards) => {
    const allComments = cards.flatMap(card => card.comments || []);
    const byId = await _buildCommentAuthorMap(allComments);
    if (!byId.size) return cards;
    return cards.map(card => ({
        ...card,
        comments: _decorateCommentList(card.comments, byId),
    }));
};

// Enrich a bare comments array returned by GET /cards/:id/comments.
const attachAuthorsToComments = async (comments) => {
    const byId = await _buildCommentAuthorMap(comments);
    return _decorateCommentList(comments, byId);
};

// ── Card-creator (post author) embed ─────────────────────────────────────────
// Attach a `creator` sub-object to each card so the client renders the post
// author's name/avatar/job without scanning the global users array. One
// User.find for the union of card.userId across the whole batch (no N+1).
// Same field name the admin cards aggregation already emits, so both surfaces
// read `card.creator`.
const attachCreator = async (cards) => {
    const idSet = new Set();
    for (const card of cards) {
        if (card.userId) idSet.add(String(card.userId));
    }
    if (!idSet.size) return cards;

    const ids = [...idSet];

    // The card byline shows "N followers", so the creator carries its own count.
    // Without it the client would have to scan a global users array to work it out —
    // which is exactly what this epic removed. One aggregation for the whole page
    // (a user's followers = everyone whose `following` contains their id), mirroring
    // countFollowersFor in usersSvc.
    const [creators, followerRows] = await Promise.all([
        User.find({ _id: { $in: ids } }, 'name lastName profilePicture job').lean(),
        User.aggregate([
            { $match: { following: { $in: ids } } },
            { $unwind: '$following' },
            { $match: { following: { $in: ids } } },
            { $group: { _id: '$following', count: { $sum: 1 } } },
        ]),
    ]);

    const byId = new Map(creators.map(u => [String(u._id), u]));
    const followersById = new Map(followerRows.map(r => [String(r._id), r.count]));

    return cards.map(card => {
        const u = byId.get(String(card.userId));
        return {
            ...card,
            // null (not undefined) for a deleted author, so the client can tell
            // "not loaded" from "no such user" — same contract as comment authors.
            creator: u
                ? {
                    _id: u._id,
                    name: u.name,
                    lastName: u.lastName,
                    profilePicture: u.profilePicture || '',
                    job: u.job || '',
                    followersCount: followersById.get(String(u._id)) || 0,
                }
                : null,
        };
    });
};

// ── The card enrichment pipeline ─────────────────────────────────────────────
// Every card payload the client renders goes through this, so a card can never
// reach the UI with its comment authors embedded but its creator missing (or
// vice versa). Adding a new card-returning endpoint? Call enrichCards/enrichCard
// and it gets every sub-object the components expect. Two batched User.finds
// (different projections/id-sets); still O(1) queries per request, not N+1.
const enrichCards = async (cards) => attachCommentAuthors(await attachCreator(cards));

// Single-card convenience wrapper (mutation responses, single-card reads).
const enrichCard = async (card) => (await enrichCards([card]))[0];

// Cursor-paginated feed. Returns { cards, nextCursor } where nextCursor is an
// opaque keyset cursor (createdAt + _id) or null at the end. opts: { cursor, limit }.
// The blocked-user filter is applied to EVERY page (computed once per request),
// so no blocked author's post can leak on any page.
const getFeedCards = async (userId, isAdmin, opts = {}) => {
    const user = await User.findById(userId);
    if(!user) throw createError(404, "User not found");

    const pageSize = normalizeLimit(opts.limit);
    let decoded = null;
    if (opts.cursor) {
        decoded = decodeCursor(opts.cursor);
        if (!decoded) throw createError(400, "Invalid feed cursor");
    }

    const hidden = await getHiddenUserIds(userId);
    // following is already cleared on block, but stay defensive about both directions.
    const followingVisible = (user.following || []).filter(id => !hidden.has(String(id)));

    // Cold-start "Suggested for you" feed: when the viewer follows nobody visible,
    // page over recent active public posts (excluding self + blocked authors) so a
    // new user never lands on a blank feed. Ordered by createdAt like the following
    // feed, so the same keyset cursor yields stable, dupe-free pages. (Previously
    // this path re-ranked by likes in-app, which cannot be paged with a stable
    // cursor — recency is used instead. See decisions log.)
    const suggested = followingVisible.length === 0;

    let baseFilter;
    if (suggested) {
        baseFilter = {
            status: 'active',
            userId: { $nin: [...hidden, String(userId)] },
        };
    } else {
        baseFilter = { userId: { $in: followingVisible } };
        if (!isAdmin) baseFilter.status = 'active';
    }

    const { page, nextCursor } = await runKeysetPage(Card, baseFilter, decoded, pageSize);

    const cards = page.map(card => {
        const safe = stripBlockedComments(pickSafeCardFields(card), hidden);
        return suggested ? { ...safe, isSuggested: true } : safe;
    });

    // Embed liker sub-objects so the feed card avatar strip renders without
    // scanning the global users array on the client. One batch User.find;
    // returns cards as plain objects with `likePreview` added.
    const cardsWithPreview = await attachLikePreview(cards);
    // Embed the post author + comment/reply authors so the card renders without a
    // global users scan. Batched User.finds (separate projections/id-sets).
    const cardsEnriched = await enrichCards(cardsWithPreview);
    return { cards: cardsEnriched, nextCursor };
}

// GET /cards/:id/likes — paginated list of users who liked a card.
// Block-aware both directions: hidden users are excluded from the likers list
// and a hidden card author 404s the whole request (mirror getPublicCard).
// Cursor = base64-encoded skip offset, consistent with getSuggestedUsers.
const getCardLikes = async (cardId, requesterId, isAdmin, opts = {}) => {
    // Verify card visibility (mirrors getPublicCard semantics)
    const card = await Card.findById(cardId);
    if (!card) throw createError(404, 'Card not found');
    if (!isAdmin && card.status !== 'active') throw createError(404, 'Card not found');

    const hidden = await getHiddenUserIds(requesterId);
    if (hidden.has(String(card.userId))) throw createError(404, 'Card not found');

    // Parse pagination options
    const lim = Math.min(Math.max(Number(opts.limit) || 20, 1), 100);
    const skip = opts.cursor
        ? parseInt(Buffer.from(opts.cursor, 'base64').toString('utf8'), 10) || 0
        : 0;

    // Filter likers: exclude blocked-either-way users
    const filteredLikerIds = (card.likes || []).filter(id => !hidden.has(String(id)));

    // Apply cursor (offset-based)
    const pageIds = filteredLikerIds.slice(skip, skip + lim);
    const hasMore = filteredLikerIds.length > skip + lim;
    const nextCursor = hasMore
        ? Buffer.from(String(skip + lim)).toString('base64')
        : null;

    if (!pageIds.length) return { users: [], nextCursor };

    // Fetch user details for this page — single query, only fields we expose
    const users = await User.find(
        { _id: { $in: pageIds } },
        '_id name lastName job profilePicture'
    ).lean();

    // Compute follower counts for the page in ONE aggregation (no N+1)
    const pageIdStrs = pageIds.map(String);
    const followerAgg = await User.aggregate([
        { $match: { following: { $in: pageIdStrs } } },
        { $unwind: '$following' },
        { $match: { following: { $in: pageIdStrs } } },
        { $group: { _id: '$following', count: { $sum: 1 } } },
    ]);
    const followerCountMap = {};
    for (const row of followerAgg) {
        followerCountMap[String(row._id)] = row.count;
    }

    // isFollowing: whether the requester follows each liker
    let myFollowingSet = new Set();
    if (requesterId) {
        const me = await User.findById(requesterId, 'following').lean();
        myFollowingSet = new Set((me?.following || []).map(String));
    }

    return {
        users: users.map(u => ({
            _id: u._id,
            name: u.name,
            lastName: u.lastName,
            job: u.job,
            profilePicture: u.profilePicture,
            followersCount: followerCountMap[String(u._id)] || 0,
            isFollowing: myFollowingSet.has(String(u._id)),
        })),
        nextCursor,
    };
};

// GET /cards/explore — cursor-paginated list of active public cards by recency.
// Optional opts.userId restricts to a single author's active posts (profile grid).
// Block-aware: hidden authors' posts are excluded on every page.
const getCardsPage = async (requesterId, isAdmin, opts = {}) => {
    const pageSize = normalizeLimit(opts.limit);
    let decoded = null;
    if (opts.cursor) {
        decoded = decodeCursor(opts.cursor);
        if (!decoded) throw createError(400, 'Invalid cursor');
    }

    const hidden = await getHiddenUserIds(requesterId);

    // If filtering to a specific user and that user is blocked either way → empty
    if (opts.userId && hidden.has(String(opts.userId))) {
        return { items: [], nextCursor: null };
    }

    const baseFilter = {};
    if (!isAdmin) baseFilter.status = 'active';

    if (opts.userId) {
        baseFilter.userId = opts.userId;
    } else if (hidden.size) {
        baseFilter.userId = { $nin: [...hidden] };
    }

    const { page, nextCursor } = await runKeysetPage(Card, baseFilter, decoded, pageSize);
    const stripped = page.map(card => stripBlockedComments(pickSafeCardFields(card), hidden));
    const items = await enrichCards(stripped);

    return { items, nextCursor };
};

// GET /cards/:id/comments — cursor-paginated embedded comments (newest first).
// Mirrors getCardLikes visibility rules. Hidden users' comments are stripped before
// paging so a blocked user's comment can never leak on any page. Replies are kept
// intact (not paginated). Uses the same keyset scheme (encodeCursor / decodeCursor)
// for a stable, dupe-free page sequence.
const getCardComments = async (cardId, requesterId, isAdmin, opts = {}) => {
    const card = await Card.findById(cardId);
    if (!card) throw createError(404, 'Card not found');
    if (!isAdmin && card.status !== 'active') throw createError(404, 'Card not found');

    const hidden = await getHiddenUserIds(requesterId);
    if (hidden.has(String(card.userId))) throw createError(404, 'Card not found');

    const pageSize = normalizeLimit(opts.limit);
    let decoded = null;
    if (opts.cursor) {
        decoded = decodeCursor(opts.cursor);
        if (!decoded) throw createError(400, 'Invalid cursor');
    }

    // Filter hidden-user comments, then sort newest-first (createdAt desc, _id desc)
    let comments = (card.comments || [])
        .filter(c => !hidden.has(String(c.userId)))
        .sort((a, b) => {
            const tDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (tDiff !== 0) return tDiff;
            const aid = String(a._id);
            const bid = String(b._id);
            return bid > aid ? -1 : bid < aid ? 1 : 0;
        });

    // Apply cursor: keep only comments strictly after the cursor key
    if (decoded) {
        const cursorTime = decoded.createdAt.getTime();
        comments = comments.filter(c => {
            const ct = new Date(c.createdAt).getTime();
            if (ct < cursorTime) return true;
            if (ct === cursorTime) return String(c._id) < decoded.id;
            return false;
        });
    }

    // Limit+1 trick to detect a following page without an extra query
    const hasMore = comments.length > pageSize;
    const page = comments.slice(0, pageSize);
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

    const items = await attachAuthorsToComments(page.map(c => c.toObject()));
    return { items, nextCursor };
};

const banCard = async (cardId) => {
    let card = await Card.findById(cardId);
    if(!card) throw createError(404, 'Card not found');

    const willBeBanned = card.status !== 'banned';
    card.status = willBeBanned ? 'banned' : 'active';

    card = await card.save();

    // Notify the author their post was removed — only on the active->banned
    // transition (not on un-ban). No fromUser: the moderator's identity is
    // deliberately not exposed.
    if(willBeBanned){
        await new Notification({actionType: 'post-removed', toUser: card.userId, whichCard: card._id}).save();
    }

    return pickSafeCardFields(card);
}

// GET /cards/search — OFFSET-cursor-paginated card search with filters and sort.
// Block-aware: hidden authors' posts are excluded on every page.
// Returns { items, nextCursor } where items are shaped via pickSafeCardFields +
// stripBlockedComments — identical wire shape to getCardsPage.
const getCardsSearch = async (requesterId, isAdmin, opts = {}) => {
    const { search, categories, sort, creatorId, cursor, limit } = opts;
    const hidden = await getHiddenUserIds(requesterId);

    // ── Base filter ─────────────────────────────────────────────────────────
    const baseFilter = {};
    if (!isAdmin) baseFilter.status = 'active';

    // userId filter: specific creator takes precedence over the hidden-set $nin.
    // We use ObjectIds here so the same filter works in both find() and aggregate().
    if (creatorId) {
        if (hidden.has(String(creatorId))) return { items: [], nextCursor: null };
        let creatorOid;
        try { creatorOid = new mongoose.Types.ObjectId(String(creatorId)); }
        catch { return { items: [], nextCursor: null }; }
        baseFilter.userId = creatorOid;
    } else if (hidden.size) {
        const hiddenOids = [];
        for (const id of hidden) {
            try { hiddenOids.push(new mongoose.Types.ObjectId(id)); } catch { /* skip invalid */ }
        }
        if (hiddenOids.length) baseFilter.userId = { $nin: hiddenOids };
    }

    // ── Search filter ────────────────────────────────────────────────────────
    // Matches title, content, category, OR creator name (name / lastName).
    if (search && search.trim()) {
        const rx = new RegExp(escapeRegex(search.trim()), 'i');
        // Find userIds of creators whose name or lastName matches the search term.
        const matchingUsers = await User.find(
            { $or: [{ name: rx }, { lastName: rx }] }, '_id'
        ).lean();
        const matchingUserOids = matchingUsers.map(u => u._id);
        baseFilter.$or = [
            { title: rx },
            { content: rx },
            { category: rx },
            { userId: { $in: matchingUserOids } },
        ];
    }

    // ── Categories filter ────────────────────────────────────────────────────
    if (categories && categories.trim()) {
        const catList = categories.split(',').map(c => c.trim()).filter(Boolean);
        if (catList.length) baseFilter.category = { $in: catList };
    }

    // ── OFFSET pagination ────────────────────────────────────────────────────
    const lim = normalizeLimit(limit);
    let skip = 0;
    if (cursor) {
        const raw = parseInt(Buffer.from(String(cursor), 'base64').toString('utf8'), 10);
        if (!Number.isFinite(raw) || raw < 0) throw createError(400, 'Invalid cursor');
        skip = raw;
    }

    // ── Sort + fetch ─────────────────────────────────────────────────────────
    let page;
    let hasMore;

    if (sort === 'most liked' || sort === 'most commented') {
        // Array-length sorts require an aggregation pipeline because MongoDB
        // cannot $sort by array length in a plain find().
        const sizeField = sort === 'most liked' ? 'lc' : 'cc';
        const sizeExpr = sort === 'most liked'
            ? { $size: '$likes' }
            : { $size: '$comments' };
        const pipeline = [
            { $match: baseFilter },
            { $addFields: { [sizeField]: sizeExpr } },
            { $sort: { [sizeField]: -1, _id: -1 } },
            { $skip: skip },
            { $limit: lim + 1 },
        ];
        const raw = await Card.aggregate(pipeline);
        hasMore = raw.length > lim;
        page = hasMore ? raw.slice(0, lim) : raw;
    } else {
        let sortObj;
        if (sort === 'oldest') sortObj = { createdAt: 1, _id: 1 };
        else sortObj = { createdAt: -1, _id: -1 }; // 'newest' or default
        const rows = await Card.find(baseFilter).sort(sortObj).skip(skip).limit(lim + 1);
        hasMore = rows.length > lim;
        page = hasMore ? rows.slice(0, lim) : rows;
    }

    const nextCursor = hasMore
        ? Buffer.from(String(skip + lim)).toString('base64')
        : null;

    const stripped = page.map(card => stripBlockedComments(pickSafeCardFields(card), hidden));
    const items = await enrichCards(stripped);
    return { items, nextCursor };
};

// GET /cards/admin — offset-paginated admin view of ALL cards with server-side
// search, filter, and sort. Admin-only — caller must verify isAdmin before calling.
// Opts: { page (1-based), limit, search (title), creator (name substring),
//         category (exact), status ('active'|'banned'|'deleted'|''), sort }.
// Sort keys: newest (createdAt desc, default), oldest, likes, likes_asc,
//            category, category_desc, creator, creator_desc.
// Returns { items, total, page, limit }. Items include creator obj, likesCount, commentsCount.
const getAdminCards = async (currentUserId, opts = {}) => {
    const { page: rawPage, limit: rawLimit, search, creator, category, status, sort } = opts;
    const pageNum = Math.max(1, parseInt(rawPage, 10) || 1);
    const lim = normalizeLimit(rawLimit, 10, 100);
    const skip = (pageNum - 1) * lim;

    // ── Sort ─────────────────────────────────────────────────────────────────
    let sortStage;
    switch (sort) {
        case 'oldest':        sortStage = { createdAt: 1,  _id: 1  };       break;
        case 'likes':         sortStage = { likesCount: -1, _id: -1 };      break;
        case 'likes_asc':     sortStage = { likesCount: 1,  _id: 1  };      break;
        case 'category':      sortStage = { category: 1,  _id: 1  };        break;
        case 'category_desc': sortStage = { category: -1, _id: -1 };        break;
        case 'creator':       sortStage = { creatorName: 1,  _id: 1  };     break;
        case 'creator_desc':  sortStage = { creatorName: -1, _id: -1 };     break;
        case 'newest':
        default:              sortStage = { createdAt: -1, _id: -1 };       break;
    }

    // ── Match clauses (applied after $lookup so we can filter on creator fields) ─
    const matchClauses = [];
    if (search && search.trim()) {
        matchClauses.push({ title: new RegExp(escapeRegex(search.trim()), 'i') });
    }
    if (creator && creator.trim()) {
        const rx = new RegExp(escapeRegex(creator.trim()), 'i');
        matchClauses.push({ $or: [{ 'creator.name': rx }, { 'creator.lastName': rx }] });
    }
    if (category && category.trim()) {
        matchClauses.push({ category: category.trim() });
    }
    if (status && status.trim()) {
        // Admin can filter by specific status; no filter = see all statuses
        matchClauses.push({ status: status.trim() });
    }

    const pipeline = [
        // Lookup creator first so we can filter/sort by name
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1, lastName: 1, profilePicture: 1 } }],
                as: '_creatorArr',
            },
        },
        // Compute derived fields (stage 1)
        {
            $addFields: {
                // $ifNull guards a legacy card whose likes/comments field is absent
                // ($size throws on a missing field).
                likesCount: { $size: { $ifNull: ['$likes', []] } },
                commentsCount: { $size: { $ifNull: ['$comments', []] } },
                creator: { $arrayElemAt: ['$_creatorArr', 0] },
            },
        },
        // Compute creatorName (stage 2 — can reference `creator` from stage 1)
        {
            $addFields: {
                creatorName: {
                    $trim: {
                        input: {
                            $concat: [
                                { $ifNull: ['$creator.name', ''] },
                                ' ',
                                { $ifNull: ['$creator.lastName', ''] },
                            ],
                        },
                    },
                },
            },
        },
        // Apply filters after all computed fields are available
        ...(matchClauses.length ? [{ $match: { $and: matchClauses } }] : []),
        // Paginate via $facet: items + total count
        {
            $facet: {
                items: [
                    { $sort: sortStage },
                    { $skip: skip },
                    { $limit: lim },
                    {
                        $project: {
                            title: 1, mediaUrl: 1, mediaType: 1,
                            category: 1, createdAt: 1, userId: 1,
                            status: 1, reportCount: 1,
                            likesCount: 1, commentsCount: 1,
                            creatorName: 1, creator: 1,
                        },
                    },
                ],
                total: [{ $count: 'n' }],
            },
        },
    ];

    const [result] = await Card.aggregate(pipeline);
    return {
        items: result.items ?? [],
        total: result.total[0]?.n ?? 0,
        page: pageNum,
        limit: lim,
    };
};

module.exports = {
    createNewCard,
    getCards,
    getFavoriteCards,
    getCard,
    getPublicCard,
    updateCard,
    deleteCard,
    likeCard,
    likeComment,
    pickSafeCardFields,
    addComment,
    addReply,
    removeComment,
    getFeedCards,
    banCard,
    getCardLikes,
    getHiddenUserIds,
    getCardsPage,
    getCardComments,
    getCardsSearch,
    getAdminCards,
}