// In-memory presence tracker. Maps userId -> number of active socket
// connections, so a user with multiple tabs/devices stays "online" until the
// last connection drops. Pure of socket/IO concerns so it can be unit-tested;
// chatSocket wires these calls to connect/disconnect and broadcasts the events.
const onlineCounts = new Map();

// Register a new connection for a user. Returns { wentOnline: true } only on
// the FIRST connection (so callers announce "user-online" once, not per tab).
function addConnection(userId) {
    const prev = onlineCounts.get(userId) || 0;
    onlineCounts.set(userId, prev + 1);
    return { wentOnline: prev === 0 };
}

// Drop one connection for a user. Returns { wentOffline: true } only when the
// last connection is gone (so callers announce "user-offline" once).
function removeConnection(userId) {
    const prev = onlineCounts.get(userId) || 0;
    if (prev <= 1) {
        onlineCounts.delete(userId);
        return { wentOffline: prev === 1 };
    }
    onlineCounts.set(userId, prev - 1);
    return { wentOffline: false };
}

function getOnlineUserIds() {
    return [...onlineCounts.keys()];
}

function isOnline(userId) {
    return onlineCounts.has(userId);
}

// Test-only: clear all tracked presence between cases.
function _reset() {
    onlineCounts.clear();
}

module.exports = {
    addConnection,
    removeConnection,
    getOnlineUserIds,
    isOnline,
    _reset,
};
