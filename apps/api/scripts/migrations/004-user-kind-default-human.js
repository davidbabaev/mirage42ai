/**
 * Migration 004 — backfill `User.kind` to 'human' on every existing user.
 *
 * Phase F adds `kind: 'human' | 'agent'` to the User schema (master-plan §5).
 * Mongoose's `default` only applies to documents it CREATES — it does not
 * rewrite documents already in the collection. So without this backfill every
 * pre-existing user has NO `kind` field at all, and that difference is not
 * cosmetic:
 *
 *   - `User.find({ kind: 'human' })` misses them entirely (a missing field does
 *     not match a value query), so any "humans only" query silently under-reports.
 *   - The `{ kind: 1 }` index would be sparse in effect, so the roster query the
 *     agent runtime runs on every heartbeat scans an inconsistent set.
 *
 * Reading code is safe either way (the projections just omit an absent field),
 * which is exactly why this would go unnoticed until an agent query returned the
 * wrong roster. Backfilling now, while the collection is small, is cheap.
 *
 * Only documents MISSING the field are touched, so an account already marked
 * 'agent' is never clobbered back to 'human'.
 *
 * IDEMPOTENT: a second run matches nothing and updates 0 users.
 *
 * Usage (from apps/api):  node scripts/migrations/004-user-kind-default-human.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { ACCOUNT_KIND } = require('@mirage42ai/shared');
const User = require('../../src/users/models/User');

const run = async () => {
    const uri = process.env.DB_CONNECTION_STRING;
    if (!uri) throw new Error('DB_CONNECTION_STRING is not set');

    await mongoose.connect(uri);
    console.log(`[004] connected to ${mongoose.connection.host}`);

    // Missing OR null — a doc written before the field existed has no key at all.
    const selector = { kind: { $in: [null] } };

    const total = await User.countDocuments({});
    const pending = await User.countDocuments(selector);
    console.log(`[004] DRY-RUN: ${total} users total; ${pending} missing \`kind\` -> '${ACCOUNT_KIND.HUMAN}'`);

    const res = await User.updateMany(selector, { $set: { kind: ACCOUNT_KIND.HUMAN } });
    console.log(`[004] APPLIED: ${res.modifiedCount} users updated`);

    const remaining = await User.countDocuments(selector);
    if (remaining !== 0) throw new Error(`expected 0 users without \`kind\`, found ${remaining}`);

    const agents = await User.countDocuments({ kind: ACCOUNT_KIND.AGENT });
    console.log(`[004] verified: 0 users without \`kind\`; ${agents} agent account(s) left untouched`);

    await mongoose.disconnect();
    console.log('[004] done');
};

run().catch(async (err) => {
    console.error('[004] failed:', err);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exit(1);
});
