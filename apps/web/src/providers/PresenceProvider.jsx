import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSocket } from '../services/socketService';
import { useAuth } from './AuthProvider';

// Live online/offline presence, kept in sync over the existing chat socket.
// The server announces user-online / user-offline to everyone and answers
// request-presence with a one-shot snapshot. Mounted above the users list and
// chat so both can show a presence dot via userPresence().
const PresenceContext = createContext({ onlineIds: new Set(), isOnline: () => false });

export function PresenceProvider({ children }) {
    const { isLoggedIn } = useAuth();
    const [onlineIds, setOnlineIds] = useState(() => new Set());

    useEffect(() => {
        const socket = getSocket();
        if (!socket || !isLoggedIn) {
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

export function usePresence() {
    return useContext(PresenceContext);
}
