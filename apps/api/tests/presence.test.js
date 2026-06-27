import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const presence = require('../src/chat/service/presenceService');

describe('presenceService', () => {
    beforeEach(() => presence._reset());

    it('reports a user online only on their first connection', () => {
        expect(presence.addConnection('u1')).toEqual({ wentOnline: true });
        // second tab/device: already online, no re-announce
        expect(presence.addConnection('u1')).toEqual({ wentOnline: false });
        expect(presence.isOnline('u1')).toBe(true);
    });

    it('keeps a user online until the LAST connection drops', () => {
        presence.addConnection('u1');
        presence.addConnection('u1');

        // first disconnect: still has another tab open -> not offline
        expect(presence.removeConnection('u1')).toEqual({ wentOffline: false });
        expect(presence.isOnline('u1')).toBe(true);

        // last disconnect: now offline
        expect(presence.removeConnection('u1')).toEqual({ wentOffline: true });
        expect(presence.isOnline('u1')).toBe(false);
    });

    it('tracks the set of online users independently', () => {
        presence.addConnection('a');
        presence.addConnection('b');
        expect(presence.getOnlineUserIds().sort()).toEqual(['a', 'b']);

        presence.removeConnection('a');
        expect(presence.getOnlineUserIds()).toEqual(['b']);
    });

    it('does not go negative or report offline for an unknown user', () => {
        expect(presence.removeConnection('ghost')).toEqual({ wentOffline: false });
        expect(presence.isOnline('ghost')).toBe(false);
        expect(presence.getOnlineUserIds()).toEqual([]);
    });
});
