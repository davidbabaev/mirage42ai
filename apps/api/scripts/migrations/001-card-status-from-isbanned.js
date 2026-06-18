/**
 * Migration 001 — Card.isBanned (Boolean) -> Card.status ('active'|'banned'|'deleted')
 *
 * Part of the hard-cut to the `status` enum (master-plan §5). This step is
 * ADDITIVE and IDEMPOTENT: it backfills `status` from the legacy `isBanned`
 * flag without touching `isBanned` itself. Migration 002 removes `isBanned`.
 *
 *   - isBanned:true            -> status:'banned'
 *   - everything else w/o status -> status:'active'
 *
 * Re-running it is a no-op (already-set docs report modifiedCount 0).
 *
 * Usage (from apps/api):  node scripts/migrations/001-card-status-from-isbanned.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Card = require('../../src/cards/models/Card');

const run = async () => {
    const uri = process.env.DB_CONNECTION_STRING;
    if (!uri) throw new Error('DB_CONNECTION_STRING is not set');

    await mongoose.connect(uri);
    const host = mongoose.connection.host;
    console.log(`[001] connected to ${host}`);

    const snapshot = async (label) => {
        const [total, banned, active, missing, legacyBanned] = await Promise.all([
            Card.countDocuments({}),
            Card.countDocuments({ status: 'banned' }),
            Card.countDocuments({ status: 'active' }),
            Card.countDocuments({ status: { $exists: false } }),
            Card.countDocuments({ isBanned: true }),
        ]);
        console.log(`[001] ${label}: total=${total} status:banned=${banned} ` +
            `status:active=${active} status:missing=${missing} isBanned:true=${legacyBanned}`);
    };

    await snapshot('before');

    const bannedRes = await Card.updateMany(
        { isBanned: true },
        { $set: { status: 'banned' } }
    );
    const activeRes = await Card.updateMany(
        { status: { $exists: false } },
        { $set: { status: 'active' } }
    );
    console.log(`[001] backfill: banned matched=${bannedRes.matchedCount} ` +
        `modified=${bannedRes.modifiedCount} | active matched=${activeRes.matchedCount} ` +
        `modified=${activeRes.modifiedCount}`);

    await snapshot('after');

    await mongoose.disconnect();
    console.log('[001] done');
};

run().catch(async (err) => {
    console.error('[001] failed:', err);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exit(1);
});
