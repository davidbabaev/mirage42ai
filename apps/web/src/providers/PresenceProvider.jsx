import React, { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../services/socketService';
import { useAuth } from './authContext';
import { PresenceContext } from './presenceContext';

export function PresenceProvider({ children }) {
    const { isLoggedIn } = useAuth();
    const [onlineIds, setOnlineIds] = useState(() => new Set());

    useEffect(() => {
        const socket = getSocket();
        if (!socket || !isLoggedIn) {
            // Auth lifecycle: synchronously clear presence on logout or before socket
            // listeners attach, so stale online indicators never show.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setOnlineIds(new Set());
            return undefined;
        }

        const onOnline = ({ userId }) =>
            setOnlineIds(prev => {
                if (prev.has(userId)) return prev;
                const next = new Set(prev);
                next.add(userId);
                return next;
            });
        const onOffline = ({ userId }) =>
            setOnlineIds(prev => {
                if (!prev.has(userId)) return prev;
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        const onSnapshot = ({ userIds }) => setOnlineIds(new Set(userIds));

        socket.on('user-online', onOnline);
        socket.on('user-offline', onOffline);
        socket.on('presence-snapshot', onSnapshot);

        // Ask for the current snapshot now that our listeners are attached.
        // socket.io buffers this emit until the connection is established.
        socket.emit('request-presence');

        return () => {
            socket.off('user-online', onOnline);
            socket.off('user-offline', onOffline);
            socket.off('presence-snapshot', onSnapshot);
        };
    }, [isLoggedIn]);

    const isOnline = useCallback((userId) => !!userId && onlineIds.has(userId), [onlineIds]);

    return (
        <PresenceContext.Provider value={{ onlineIds, isOnline }}>
            {children}
        </PresenceContext.Provider>
    );
}

