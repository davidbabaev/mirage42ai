const mongoose = require('mongoose');

// Reusable keyset (cursor) pagination for collections sorted newest-first by
// (<field> desc, _id desc). Keyset — NOT offset — so rows inserted at the top
// while the client is paging never cause duplicates or skips. The sort field is
// `createdAt` by default (feed, comments, user lists, notifications); callers
// that order by a different timestamp (e.g. the conversation list sorts by
// `updatedAt`, which moves when a new message arrives) pass that field name.

const SORT = { createdAt: -1, _id: -1 };
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

// Clamp a client-supplied limit into [1, max], falling back to def for junk.
const normalizeLimit = (raw, def = DEFAULT_LIMIT, max = MAX_LIMIT) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(n, max);
};

// Opaque cursor: base64url of the last returned row's sort key. `field` selects
// which timestamp (createdAt by default, updatedAt for the conversation list).
const encodeCursor = (doc, field = 'createdAt') => {
    if (!doc) return null;
    const payload = JSON.stringify({
        t: new Date(doc[field]).toISOString(),
        i: String(doc._id),
    });
    return Buffer.from(payload, 'utf8').toString('base64url');
};

// Decode to { createdAt: Date, value: Date, id: string }, or null if
// missing/garbage so the caller can reject a malformed cursor (fail fast) rather
// than silently paging. `value` is the sort-key timestamp regardless of which
// field it came from; `createdAt` is kept as a backward-compatible alias.
const decodeCursor = (cursor) => {
    if (!cursor) return null;
    try {
        const { t, i } = JSON.parse(
            Buffer.from(String(cursor), 'base64url').toString('utf8')
        );
        const value = new Date(t);
        if (Number.isNaN(value.getTime()) || !i || !mongoose.Types.ObjectId.isValid(i)) {
            return null;
        }
        return { createdAt: value, value, id: i };
    } catch {
        return null;
    }
};

// Mongo predicate selecting rows strictly AFTER the cursor in (<field> desc,
// _id desc) order. Combined with the caller's base filter via $and.
const cursorMatch = (decoded, field = 'createdAt') => {
    if (!decoded) return null;
    const id = new mongoose.Types.ObjectId(decoded.id);
    const value = decoded.value ?? decoded.createdAt;
    return {
        $or: [
            { [field]: { $lt: value } },
            { [field]: value, _id: { $lt: id } },
        ],
    };
};

// Run one keyset page against a Mongoose model. Uses the limit-(N+1) trick to
// learn whether a further page exists without a second query, and returns the
// opaque cursor for the next page (null at the end). `page` are raw Mongoose docs
// so the caller can shape/strip them. `field` is the sort timestamp (default
// createdAt); it drives the sort, the cursor predicate, and the emitted cursor.
const runKeysetPage = async (model, baseFilter, decoded, pageSize, field = 'createdAt') => {
    const match = cursorMatch(decoded, field);
    const query = match ? { $and: [baseFilter, match] } : baseFilter;
    const sort = { [field]: -1, _id: -1 };

    const rows = await model.find(query).sort(sort).limit(pageSize + 1);
    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1], field) : null;

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
