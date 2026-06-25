/**
 * Migration 003 — de-duplicate and clean every user's `following` array.
 *
 * Fixes the inflated "Following" count (e.g. a profile showing 10 while the user
 * actually follows 4). The display reads `following.length` directly, so a stored
 * array carrying duplicate or stale ids reads as an inflated count. The write-path
 * fix (followUser now uses $addToSet/$pull) stops NEW corruption, but it does not
 * retroactively shrink arrays already polluted — that is this one-off cleanup.
 *
 * For every user, `following` is rewritten to the set of ids that:
 *   - are de-duplicated (Array.from(new Set(following)) — kills duplicate ids), AND
 *   - still point at an EXISTING, NON-BANNED user.
 *
 * Why drop banned-user ids too: Part 1 makes a ban $pull the banned id out of
 * everyone's `following` going forward, so historical data must match that new
 * behavior — otherwise a user banned before this change keeps inflating counts.
 * Orphan ids (no matching user at all — e.g. a user deleted in some edge path)
 * are dropped for the same reason.
 *
 * IDEMPOTENT: a second run finds nothing to change (0 users updated).
 *
 * Usage (from apps/api):  node scripts/migrations/003-dedupe-clean-following.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../../src/users/models/User');

const run = async () => {
    const uri = process.env.DB_CONNECTION_STRING;
    if (!uri) throw new Error('DB_CONNECTION_STRING is not set');

    await mongoose.connect(uri);
    console.log(`[003] connected to ${mongoose.connection.host}`);

    // Valid follow targets = existing, non-banned users.
    const allUsers = await User.find({}, { _id: 1, isBanned: 1, email: 1, following: 1 });
    const validIds = new Set(
        allUsers.filter(u => !u.isBanned).map(u => String(u._id))
    );

    // Build the cleanup plan (dry-run summary BEFORE writing anything).
    const plan = [];
    let usersWithDuplicates = 0;
    let usersWithOrphans = 0;
    let totalEntriesRemoved = 0;

    for (const u of allUsers) {
        const original = (u.following || []).map(String);
        const deduped = Array.from(new Set(original));
        const cleaned = deduped.filter(id => validIds.has(id));

        const hadDuplicates = deduped.length < original.length;
        // "Orphan/stale" = present (after de-dup) but not a valid target.
        const orphansRemoved = deduped.length - cleaned.length;

        if (hadDuplicates) usersWithDuplicates += 1;
        if (orphansRemoved > 0) usersWithOrphans += 1;

        if (cleaned.length !== original.length) {
            totalEntriesRemoved += original.length - cleaned.length;
            plan.push({ id: String(u._id), email: u.email, before: original.length, after: cleaned.length, cleaned });
        }
    }

    console.log(`[003] scanned ${allUsers.length} users; valid (non-banned) targets=${validIds.size}`);
    console.log(`[003] DRY-RUN: users to update=${plan.length} ` +
        `(with duplicates=${usersWithDuplicates}, with orphan/banned ids=${usersWithOrphans}) ` +
        `total entries to remove=${totalEntriesRemoved}`);

    // Spotlight the reported user if present.
    const reported = allUsers.find(u => u.email === 'david@test.com');
    if (reported) {
        const before = (reported.following || []).length;
        const after = Array.from(new Set((reported.following || []).map(String)))
            .filter(id => validIds.has(id)).length;
        console.log(`[003] david@test.com: following before=${before} -> after=${after}`);
    } else {
        console.log('[003] david@test.com: not found in this database');
    }

    // Apply.
    let updated = 0;
    for (const p of plan) {
        await User.updateOne({ _id: p.id }, { $set: { following: p.cleaned } });
        updated += 1;
    }
    console.log(`[003] APPLIED: ${updated} users updated`);

    await mongoose.disconnect();
    console.log('[003] done');
};

run().catch(async (err) => {
    console.error('[003] failed:', err);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exit(1);
});
