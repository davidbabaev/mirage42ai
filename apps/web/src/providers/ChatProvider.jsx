import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getChats, markChatRead, deleteChat } from '../services/apiService';
import { getSocket } from '../services/socketService';
import { useAuth } from './authContext';
import { ChatContext } from './chatContext';

export function ChatProvider({ children }) {
    const { user, isLoggedIn } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalUnread, setTotalUnread] = useState(0);

    // Mirror of `conversations` kept in sync on every update so socket handlers
    // can read the current rows (and compute unread deltas) without re-subscribing.
    const conversationsRef = useRef([]);
    const loadingMoreRef = useRef(false);
    // which conversation is currently open on screen
    const activeIdRef = useRef(null);

    // Set conversations state and the ref together, so reads are never stale.
    const applyConversations = useCallback((updater) => {
        setConversations(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            conversationsRef.current = next;
            return next;
        });
    }, []);

    // Load the first (newest) page: replaces the list, seeds the cursor + total.
    const fetchChats = useCallback(async () => {
        // auth-aware: never hit /chats while logged out
        const token = localStorage.getItem('auth-token');
        if (!token) return;
        try {
            const res = await getChats();
            applyConversations(res.conversations || []);
            setNextCursor(res.nextCursor || null);
            setTotalUnread(res.totalUnread || 0);
        } catch (err) {
            console.log(err.message);
        }
    }, [applyConversations]);

    // Load the next-older page and append (de-duped); leaves the total untouched
    // (cursor pages don't carry it — it's already seeded from page 1).
    const loadMore = useCallback(async () => {
        if (!nextCursor || loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        try {
            const res = await getChats({ cursor: nextCursor });
            applyConversations(prev => {
                const have = new Set(prev.map(c => c._id));
                const fresh = (res.conversations || []).filter(c => !have.has(c._id));
                return [...prev, ...fresh];
            });
            setNextCursor(res.nextCursor || null);
        } catch (err) {
            console.log(err.message);
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [nextCursor, applyConversations]);

    // Fetch on login; clear on logout (mirrors UsersProvider/CardsProvider).
    useEffect(() => {
        if (isLoggedIn) fetchChats();
        else {
            applyConversations([]);
            setNextCursor(null);
            setTotalUnread(0);
        }
    }, [isLoggedIn, fetchChats, applyConversations]);

    // Zero one conversation's unread and subtract it from the nav total.
    const zeroConversationUnread = useCallback((conversationId) => {
        const c = conversationsRef.current.find(x => x._id === conversationId);
        const delta = c?.unreadCount || 0;
        applyConversations(prev => prev.map(x => (x._id === conversationId ? { ...x, unreadCount: 0 } : x)));
        if (delta) setTotalUnread(t => Math.max(0, t - delta));
    }, [applyConversations]);

    const setActiveConversationId = useCallback((id) => {
        activeIdRef.current = id;
        if (id) zeroConversationUnread(id);
    }, [zeroConversationUnread]);

    const markRead = useCallback(async (conversationId) => {
        if (!conversationId) return;
        zeroConversationUnread(conversationId);
        try { await markChatRead(conversationId); } catch (err) { console.log(err.message); }
    }, [zeroConversationUnread]);

    const removeConversation = useCallback((conversationId) => {
        const c = conversationsRef.current.find(x => x._id === conversationId);
        const delta = c?.unreadCount || 0;
        applyConversations(prev => prev.filter(x => x._id !== conversationId));
        if (delta) setTotalUnread(t => Math.max(0, t - delta));
    }, [applyConversations]);

    const deleteConversation = useCallback(async (conversationId) => {
        removeConversation(conversationId);
        try { await deleteChat(conversationId); } catch (err) { console.log(err.message); }
    }, [removeConversation]);

    // Live updates: a new message bumps the row (preview + unread + sort to top);
    // reads/deletes from other tabs or the other user keep the list in sync.
    useEffect(() => {
        const socket = getSocket();
        if (!socket || !isLoggedIn) return undefined;

        const onReceive = (msg) => {
            const existing = conversationsRef.current.find(c => c._id === msg.conversationId);
            if (!existing) {
                // A conversation we don't hold yet: a brand-new thread, or one on an
                // un-loaded page. Refetch page 1 — it bumps this thread to the top
                // and re-seeds totalUnread server-side (authoritative, no drift).
                fetchChats();
                return;
            }
            const isMine = msg.userId === user?._id;
            const isActive = msg.conversationId === activeIdRef.current;
            applyConversations(prev => {
                const idx = prev.findIndex(c => c._id === msg.conversationId);
                if (idx === -1) return prev;
                const c = prev[idx];
                const updated = {
                    ...c,
                    updatedAt: msg.createdAt,
                    lastMessage: {
                        text: msg.text,
                        mediaType: msg.mediaType,
                        senderId: msg.userId,
                        createdAt: msg.createdAt,
                    },
                    unreadCount: (isMine || isActive) ? 0 : (c.unreadCount || 0) + 1,
                };
                return [updated, ...prev.filter((_, i) => i !== idx)];
            });
            if (!isMine && !isActive) setTotalUnread(t => t + 1);
        };
        const onRead = ({ conversationId }) => zeroConversationUnread(conversationId);
        const onDeleted = (deletedId) => removeConversation(deletedId);

        socket.on('receive-message', onReceive);
        socket.on('conversation-read', onRead);
        socket.on('deleted-conversation', onDeleted);
        return () => {
            socket.off('receive-message', onReceive);
            socket.off('conversation-read', onRead);
            socket.off('deleted-conversation', onDeleted);
        };
    }, [isLoggedIn, user?._id, fetchChats, applyConversations, zeroConversationUnread, removeConversation]);

    const value = {
        conversations,
        totalUnread,
        hasMore: !!nextCursor,
        loadingMore,
        loadMore,
        fetchChats,
        markRead,
        deleteConversation,
        setActiveConversationId,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

