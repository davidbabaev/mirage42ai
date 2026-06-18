/**
 * Migration 002 — drop the legacy Card.isBanned field (hard-cut, part 2).
 *
 * Migration 001 backfilled `status` from `isBanned` additively. This step
 * removes `isBanned` from the stored documents now that the schema no longer
 * declares it. It is IDEMPOTENT (a second run matches 0 docs).
 *
 * CRITICAL — reconcile before unsetting: any card banned in the window between
 * the 001/code deploy and this run could carry isBanned:true without a matching
 * status:'banned'. We re-run the banned backfill FIRST so that ban is preserved;
 * only then do we strip isBanned. Skipping this would silently lose that ban at
 * cutover (matters on staging/prod where the C1->C2 gap is real).
 *
 * Operations go through the native driver collection (Card.collection) on
 * purpose: `isBanned` is no longer in the Mongoose schema, so a model-level
 * $unset would be stripped by strict mode and silently do nothing.
 *
 * Usage (from apps/api):  node scripts/migrations/002-card-drop-isbanned.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Card = require('../../src/cards/models/Card');

const run = async () => {
    const uri = process.env.DB_CONNECTION_STRING;
    if (!uri) throw new Error('DB_CONNECTION_STRING is not set');

    await mongoose.connect(uri);
    const col = Card.collection;
    console.log(`[002] connected to ${mongoose.connection.host}`);

    const snapshot = async (label) => {
        const [total, banned, active, withIsBanned, legacyBanned] = await Promise.all([
            col.countDocuments({}),
            col.countDocuments({ status: 'banned' }),
            col.countDocuments({ status: 'active' }),
            col.countDocuments({ isBanned: { $exists: true } }),
            col.countDocuments({ isBanned: true }),
        ]);
        console.log(`[002] ${label}: total=${total} status:banned=${banned} ` +
            `status:active=${active} has(isBanned)=${withIsBanned} isBanned:true=${legacyBanned}`);
    };

    await snapshot('before');

    // 1. Reconcile any ban that landed after 001 ran (before stripping the field).
    const reconcile = await col.updateMany(
        { isBanned: true },
        { $set: { status: 'banned' } }
    );
    console.log(`[002] reconcile isBanned:true -> status:'banned': ` +
        `matched=${reconcile.matchedCount} modified=${reconcile.modifiedCount}`);

    // 2. Now it is safe to drop the legacy field.
    const unset = await col.updateMany(
        { isBanned: { $exists: true } },
        { $unset: { isBanned: '' } }
    );
    console.log(`[002] $unset isBanned: matched=${unset.matchedCount} modified=${unset.modifiedCount}`);

    await snapshot('after');

    await mongoose.disconnect();
    console.log('[002] done');
};

run().catch(async (err) => {
    console.error('[002] failed:', err);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exit(1);
});
