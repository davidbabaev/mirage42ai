import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useChat from './useChat';
import { useAuth } from '../providers/authContext';
import { useChatList } from '../providers/chatContext';

// Encapsulates a single conversation thread (message load + send + receive +
// smart-scroll + media/emoji input state), so it can drive a docked chat window
// the same way ChatPage drives the full-screen thread. `active` = the thread is
// open and focused (drives mark-read). Mirrors the logic in ChatPage.jsx.
export default function useConversationThread(otherUser, active) {
    const { user } = useAuth();
    const { conversations, markRead, deleteConversation, setActiveConversationId } = useChatList();

    // Resolve the conversation id for this pair (null for a brand-new chat).
    const resolved = useMemo(() => {
        if (!otherUser || !user) return null;
        const c = conversations.find((c) =>
            (c.fromUser === user._id && c.toUser === otherUser._id) ||
            (c.fromUser === otherUser._id && c.toUser === user._id));
        return c?._id || null;
    }, [conversations, otherUser, user]);

    const [conversationId, setConversationId] = useState(resolved);
    useEffect(() => {
        if (resolved && resolved !== conversationId) setConversationId(resolved);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolved]);

    const onDeleted = useCallback((deletedId) => {
        setConversationId((prev) => (prev === deletedId ? null : prev));
    }, []);

    const onReceived = useCallback((newMessage) => {
        // Adopt the conversation id once the first message of a new chat arrives.
        setConversationId((prev) => {
            if (prev) return prev;
            const match = newMessage.userId === otherUser?._id || newMessage.userId === user?._id;
            return match ? newMessage.conversationId : prev;
        });
    }, [otherUser?._id, user?._id]);

    const { handleOpenConversation, handleSendNewMessage, chatMessages, loadOlderMessages,
        hasOlderMessages, loadingOlder, sendError, clearSendError } =
        useChat(conversationId, onDeleted, onReceived);

    useEffect(() => {
        if (conversationId) handleOpenConversation(conversationId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

    // Mark read while the thread is open + focused.
    useEffect(() => {
        if (!active) return;
        setActiveConversationId(conversationId ?? null);
        if (conversationId) markRead(conversationId);
        return () => setActiveConversationId(null);
    }, [active, conversationId, setActiveConversationId, markRead]);

    // ---- input state ----
    const [messageText, setMessageText] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const fileInputRef = useRef(null);
    const previewMedia = useMemo(() => (mediaFile ? URL.createObjectURL(mediaFile) : null), [mediaFile]);
    useEffect(() => () => { if (previewMedia) URL.revokeObjectURL(previewMedia); }, [previewMedia]);

    const onEmojiClick = (e) => { setMessageText((p) => p + e.emoji); setIsEmojiOpen(false); };

    const handleSend = () => {
        if (!messageText.trim() && !mediaFile) return;
        handleSendNewMessage({ text: messageText, toUser: otherUser._id, mediaFile });
        setMessageText('');
        setMediaFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ---- smart scroll ----
    const [isChatReady, setIsChatReady] = useState(false);
    const containerRef = useRef(null);
    const endRef = useRef(null);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [hasNewBelow, setHasNewBelow] = useState(false);
    const isNearBottomRef = useRef(true);
    const prevConvIdRef = useRef(undefined);
    const prevLenRef = useRef(0);
    const prevLastIdRef = useRef(null);
    const pendingPrependHeightRef = useRef(null);

    const scrollToBottom = (behavior = 'smooth') => { endRef.current?.scrollIntoView({ behavior }); setHasNewBelow(false); };
    const onScroll = () => {
        const c = containerRef.current; if (!c) return;
        const d = c.scrollHeight - c.scrollTop - c.clientHeight;
        const near = d < 120; isNearBottomRef.current = near; setIsNearBottom(near); if (near) setHasNewBelow(false);
        if (c.scrollTop < 80 && hasOlderMessages && !loadingOlder) {
            pendingPrependHeightRef.current = c.scrollHeight;
            loadOlderMessages();
        }
    };

    // Preserve scroll position when older messages are prepended (see ChatPage).
    useLayoutEffect(() => {
        const c = containerRef.current;
        if (!c || pendingPrependHeightRef.current == null) return;
        const delta = c.scrollHeight - pendingPrependHeightRef.current;
        if (delta > 0) c.scrollTop = c.scrollTop + delta;
        pendingPrependHeightRef.current = null;
    }, [chatMessages]);

    useEffect(() => {
        const len = chatMessages.length; if (len === 0) return;
        const convId = chatMessages[0]?.conversationId;
        const changed = convId !== prevConvIdRef.current;
        const lastId = chatMessages[len - 1]?._id;
        const tailChanged = lastId !== prevLastIdRef.current;
        if (changed) {
            endRef.current?.scrollIntoView({ behavior: 'auto' });
            setHasNewBelow(false); setIsNearBottom(true); isNearBottomRef.current = true;
        } else if (tailChanged && len > prevLenRef.current) {
            const last = chatMessages[len - 1];
            const mine = last?.userId === user?._id;
            if (mine || isNearBottomRef.current) scrollToBottom('smooth'); else setHasNewBelow(true);
        }
        requestAnimationFrame(() => setIsChatReady(true));
        prevConvIdRef.current = convId; prevLenRef.current = len; prevLastIdRef.current = lastId;
    }, [chatMessages, user?._id]);

    return {
        user, conversationId, chatMessages, loadingOlder,
        messageText, setMessageText, mediaFile, setMediaFile, previewMedia, fileInputRef,
        isEmojiOpen, setIsEmojiOpen, onEmojiClick, handleSend,
        isChatReady, containerRef, endRef, isNearBottom, hasNewBelow, scrollToBottom, onScroll,
        deleteConversation, sendError, clearSendError,
    };
}
