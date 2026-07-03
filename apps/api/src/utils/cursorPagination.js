const mongoose = require('mongoose');

// Reusable keyset (cursor) pagination for collections sorted newest-first by
// (createdAt desc, _id desc). Keyset — NOT offset — so rows inserted at the top
// while the client is paging never cause duplicates or skips. The feed uses it
// now; comments and user lists can adopt the same helpers later.

const SORT = { createdAt: -1, _id: -1 };
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

// Clamp a client-supplied limit into [1, max], falling back to def for junk.
const normalizeLimit = (raw, def = DEFAULT_LIMIT, max = MAX_LIMIT) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(n, max);
};

// Opaque cursor: base64url of the last returned row's sort key.
const encodeCursor = (doc) => {
    if (!doc) return null;
    const payload = JSON.stringify({
        t: new Date(doc.createdAt).toISOString(),
        i: String(doc._id),
    });
    return Buffer.from(payload, 'utf8').toString('base64url');
};

// Decode to { createdAt: Date, id: string }, or null if missing/garbage so the
// caller can reject a malformed cursor (fail fast) rather than silently paging.
const decodeCursor = (cursor) => {
    if (!cursor) return null;
    try {
        const { t, i } = JSON.parse(
            Buffer.from(String(cursor), 'base64url').toString('utf8')
        );
        const createdAt = new Date(t);
        if (Number.isNaN(createdAt.getTime()) || !i || !mongoose.Types.ObjectId.isValid(i)) {
            return null;
        }
        return { createdAt, id: i };
    } catch {
        return null;
    }
};

// Mongo predicate selecting rows strictly AFTER the cursor in (createdAt desc,
// _id desc) order. Combined with the caller's base filter via $and.
const cursorMatch = (decoded) => {
    if (!decoded) return null;
    const id = new mongoose.Types.ObjectId(decoded.id);
    return {
        $or: [
            { createdAt: { $lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, _id: { $lt: id } },
        ],
    };
};

// Run one keyset page against a Mongoose model. Uses the limit-(N+1) trick to
// learn whether a further page exists without a second query, and returns the
// opaque cursor for the next page (null at the end). `page` are raw Mongoose docs
// so the caller can shape/strip them.
const runKeysetPage = async (model, baseFilter, decoded, pageSize) => {
    const match = cursorMatch(decoded);
    const query = match ? { $and: [baseFilter, match] } : baseFilter;

    const rows = await model.find(query).sort(SORT).limit(pageSize + 1);
    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

    return { page, nextCursor };
};

module.exports = {
    SORT,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    normalizeLimit,
    encodeCursor,
    decodeCursor,
    cursorMatch,
    runKeysetPage,
};
