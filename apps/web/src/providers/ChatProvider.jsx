import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getChats, markChatRead, deleteChat } from '../services/apiService';
import { getSocket } from '../services/socketService';
import { useAuth } from './AuthProvider';

// Single source of truth for the conversation list, per-conversation unread,
// last-message preview, and the nav total — kept live via sockets. Mounted
// above NavBar and ChatPage so both share it.
const ChatContext = createContext(null);

export function ChatProvider({ children }) {
    const { user, isLoggedIn } = useAuth();
    const [conversations, setConversations] = useState([]);
    // which conversation is currently open on screen (read via ref inside the
    // socket handler so it stays current without re-subscribing)
    const activeIdRef = useRef(null);

    const fetchChats = useCallback(async () => {
        // auth-aware: never hit /chats while logged out
        const token = localStorage.getItem('auth-token');
        if (!token) return;
        try {
            const res = await getChats();
            setConversations(res);
        } catch (err) {
            console.log(err.message);
        }
    }, []);

    // Fetch on login; clear on logout (mirrors UsersProvider/CardsProvider).
    useEffect(() => {
        if (isLoggedIn) fetchChats();
        else setConversations([]);
    }, [isLoggedIn, fetchChats]);

    const setActiveConversationId = useCallback((id) => {
        activeIdRef.current = id;
        if (id) {
            setConversations(prev => prev.map(c => (c._id === id ? { ...c, unreadCount: 0 } : c)));
        }
    }, []);

    const markRead = useCallback(async (conversationId) => {
        if (!conversationId) return;
        setConversations(prev => prev.map(c => (c._id === conversationId ? { ...c, unreadCount: 0 } : c)));
        try { await markChatRead(conversationId); } catch (err) { console.log(err.message); }
    }, []);

    const removeConversation = useCallback((conversationId) => {
        setConversations(prev => prev.filter(c => c._id !== conversationId));
    }, []);

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
            setConversations(prev => {
                const idx = prev.findIndex(c => c._id === msg.conversationId);
                if (idx === -1) {
                    // a conversation we don't have yet (e.g. first message) — refetch
                    fetchChats();
                    return prev;
                }
                const c = prev[idx];
                const isMine = msg.userId === user?._id;
                const isActive = msg.conversationId === activeIdRef.current;
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
        };
        const onRead = ({ conversationId }) => {
            setConversations(prev => prev.map(c => (c._id === conversationId ? { ...c, unreadCount: 0 } : c)));
        };
        const onDeleted = (deletedId) => removeConversation(deletedId);

        socket.on('receive-message', onReceive);
        socket.on('conversation-read', onRead);
        socket.on('deleted-conversation', onDeleted);
        return () => {
            socket.off('receive-message', onReceive);
            socket.off('conversation-read', onRead);
            socket.off('deleted-conversation', onDeleted);
        };
    }, [isLoggedIn, user?._id, fetchChats, removeConversation]);

    const totalUnread = useMemo(
        () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
        [conversations]
    );

    const value = {
        conversations,
        totalUnread,
        fetchChats,
        markRead,
        deleteConversation,
        setActiveConversationId,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatList() {
    return useContext(ChatContext);
}
