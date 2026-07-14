import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useChat from '../../hooks/useChat'
import { useAuth } from '../../providers/authContext';
import { Alert, Box, Container, Grid, Snackbar } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSingleUser } from '../../services/apiService';
import { useUI } from '../../providers/uiContext';
import { useChatList } from '../../providers/chatContext';
import ConversationList from './components/ConversationList';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import ChatEmptyState from './components/ChatEmptyState';
import ScrollToBottomButton from './components/ScrollToBottomButton';
import useBlockUser from '../../hooks/useBlockUser';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import BlockIcon from '@mui/icons-material/Block';

export default function ChatPage() {

    const [selectedChat, setSelectedChat] = useState(null);
    const [messageText, setMessageText] = useState('');
    const navigate = useNavigate();
    const {user} = useAuth();
    const {setIsChatOpen} = useUI();
    const {conversations, hasMore, loadingMore, loadMore, markRead, deleteConversation, setActiveConversationId} = useChatList();

    // Block flow
    const { toggleBlock } = useBlockUser();
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    const [blockToast, setBlockToast] = useState('');

    const handleBlockConfirm = async () => {
        const otherId = selectedChat?.otherUser?._id;
        if (!otherId || otherId === user?._id) return;
        setIsBlocking(true);
        try {
            const result = await toggleBlock(otherId);
            if (result) {
                const blockedName = selectedChat?.otherUser?.name ?? 'User';
                setBlockConfirmOpen(false);
                setSelectedChat(null);
                setBlockToast(`${blockedName} has been blocked.`);
            }
        } finally {
            setIsBlocking(false);
        }
    };

    // emoji
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const onEmojiClick = (emojiData) => {
        setMessageText(prev => prev + emojiData.emoji);
        setIsEmojiOpen(false);
    }

    // Media handling
    const [mediaFile, setMediaFile] = useState(null);

    const previewMedia = useMemo(() => {
        return mediaFile ? URL.createObjectURL(mediaFile) : null;
    }, [mediaFile])

    const fileInputRef = useRef(null); // hidden input holding

    useEffect(() => {
        // If selectedChat is an object (a chat is open) → !!selectedChat = true
        // If selectedChat is null (no chat open) → !!selectedChat = false
        setIsChatOpen(!!selectedChat);

        // when leaving the chat page entierly, reset the flag
        return () => setIsChatOpen(false);
    }, [selectedChat, setIsChatOpen])

    // the cleanup function that cptured previewMedia from the previous render. it revokes the old URL - not the new one that just got created.
    useEffect(() => {
        return () => {
            if(previewMedia) URL.revokeObjectURL(previewMedia)
            }
    }, [previewMedia])

    const handleConversationDeleted = useCallback((deletedId) => {
        setSelectedChat(prev => {
            if(prev?.conversationId === deletedId){
                return null;
            }
            return prev
        })
    }, [])

    const handleMessageReceived = useCallback((newMessage) => {
        setSelectedChat(prev => {
            if(!prev) return prev;
            if(prev.conversationId !== null) return prev;

            const isMatch =
                newMessage.userId === prev.otherUser?._id ||
                newMessage.userId === user._id;

            if(isMatch) {
                return{
                    ...prev,
                    conversationId: newMessage.conversationId
                }
            }
            return prev;
        })
    }, [user?._id])

    const {
        handleOpenConversation,
        handleSendNewMessage,
        chatMessages,
        loadOlderMessages,
        hasOlderMessages,
        loadingOlder,
        sendError,
        clearSendError
    } = useChat(
        selectedChat?.conversationId,
        handleConversationDeleted,
        handleMessageReceived
    );

    // keep ChatProvider in sync with which conversation is on screen, and mark
    // it read when opened (clears its badge + the nav total)
    useEffect(() => {
        const id = selectedChat?.conversationId ?? null;
        setActiveConversationId(id);
        if (id) markRead(id);
        // Clear the active conversation when leaving the chat page (unmount) or
        // switching conversations. Without this, ChatProvider keeps treating the
        // last-opened conversation as "active" after you navigate away, so its
        // incoming messages never bump the unread badge.
        return () => setActiveConversationId(null);
    }, [selectedChat?.conversationId, setActiveConversationId, markRead])

    const handleSend = () => {
        handleSendNewMessage({
            text: messageText,
            toUser: selectedChat.otherUser._id,
            mediaFile: mediaFile,
        })
        setMessageText('');
        setMediaFile(null)
        fileInputRef.current.value = ''
    }

    // chat display settings
    const [isChatReady, setIsChatReady] = useState(false)
    const messageContainerRef = useRef(null);
    const messageEndRef = useRef(null);

    // smart-scroll bookkeeping
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [hasNewBelow, setHasNewBelow] = useState(false);
    const isNearBottomRef = useRef(true);   // read inside the effect without re-subscribing
    const prevConvIdRef = useRef(undefined);
    const prevLenRef = useRef(0);
    const prevLastIdRef = useRef(null);        // tail identity: distinguishes append from prepend
    const pendingPrependHeightRef = useRef(null); // scrollHeight captured before an older-page load

    const scrollToBottom = (behavior = 'smooth') => {
        messageEndRef.current?.scrollIntoView({ behavior });
        setHasNewBelow(false);
    };

    const handleMessagesScroll = () => {
        const c = messageContainerRef.current;
        if (!c) return;
        const distanceFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
        const near = distanceFromBottom < 120;
        isNearBottomRef.current = near;
        setIsNearBottom(near);
        if (near) setHasNewBelow(false);

        // Near the top → load the next-older page. Capture scrollHeight first so
        // the layout effect can restore the position after the prepend.
        if (c.scrollTop < 80 && hasOlderMessages && !loadingOlder) {
            pendingPrependHeightRef.current = c.scrollHeight;
            loadOlderMessages();
        }
    };

    // Anchor the viewport when older messages are prepended: keep the same message
    // under the user's eyes by shifting scrollTop down by the inserted height.
    // Runs before paint so there's no visible jump.
    useLayoutEffect(() => {
        const c = messageContainerRef.current;
        if (!c || pendingPrependHeightRef.current == null) return;
        const delta = c.scrollHeight - pendingPrependHeightRef.current;
        if (delta > 0) c.scrollTop = c.scrollTop + delta;
        pendingPrependHeightRef.current = null;
    }, [chatMessages])

    useEffect(() => {
        const len = chatMessages.length;
        if (len === 0) return;

        // detect the open conversation from the loaded data (not the id state,
        // which updates before the messages do)
        const convId = chatMessages[0]?.conversationId;
        const convChanged = convId !== prevConvIdRef.current;
        const lastId = chatMessages[len - 1]?._id;
        const tailChanged = lastId !== prevLastIdRef.current;

        if (convChanged) {
            // fresh conversation: jump to the latest instantly
            messageEndRef.current?.scrollIntoView({ behavior: 'auto' });
            setHasNewBelow(false);
            setIsNearBottom(true);
            isNearBottomRef.current = true;
        } else if (tailChanged && len > prevLenRef.current) {
            // a new message appended at the tail (NOT an older-page prepend, which
            // grows the list at the front and leaves the tail identity unchanged)
            const last = chatMessages[len - 1];
            const mine = last?.userId === user?._id;
            if (mine || isNearBottomRef.current) {
                scrollToBottom('smooth');
            } else {
                setHasNewBelow(true); // they're reading history — don't yank
            }
        }

        // reveal once messages are present (kept hidden until the first paint to
        // avoid a scroll-jump flash)
        requestAnimationFrame(() => setIsChatReady(true));

        prevConvIdRef.current = convId;
        prevLenRef.current = len;
        prevLastIdRef.current = lastId;
    }, [chatMessages, user?._id])

    useEffect(() => {
        setMessageText('');
    }, [selectedChat?.conversationId])

    const [searchParams, setSearchParams] = useSearchParams();
    const toUserId = searchParams.get('to')

    useEffect(() => {
        if(!toUserId) return;

        const conversation = conversations.find(c =>
            (c.fromUser === user._id && c.toUser === toUserId) ||
            (c.fromUser === toUserId && c.toUser === user._id)
        )

        if(conversation){
            // Partner is embedded on the conversation by the server.
            setIsChatReady(false);
            setSelectedChat({
                conversationId: conversation._id,
                otherUser: conversation.otherUser
            })
            handleOpenConversation(conversation._id)
            setSearchParams({}, {replace: true})
            return;
        }

        // No loaded conversation with this user yet — fetch just that user to open
        // a fresh chat (fetch once; the server resurfaces any existing conversation
        // on the first send). Avoids scanning a global users array.
        if(selectedChat?.otherUser?._id === toUserId) return;
        let cancelled = false;
        getSingleUser(toUserId)
            .then(u => { if(!cancelled) setSelectedChat({ conversationId: null, otherUser: u }); })
            .catch(() => {});
        return () => { cancelled = true; };

    }, [toUserId, conversations, user, selectedChat?.otherUser?._id])

    const handleSelectChat = (chat, otherUser) => {
        setIsChatReady(false);
        setSelectedChat({
            conversationId: chat._id,
            otherUser: otherUser
        })
        handleOpenConversation(chat._id)
    }

return (
<Container
    maxWidth='lg'
    sx={{
        py: {xs: 0, md: 3},
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        p:{xs: 0, md: 4}
    }}>
<Grid container spacing={3} sx={{flex: 1, minHeight: 0}}>
    {/* Chats left side */}
    <Grid size={{xs: 12, md:4}}
        sx={{
            height: '100%',
            display: {xs: selectedChat ? 'none' : 'block', md: 'block'}
        }}>
        <ConversationList
            conversationsList={conversations}
            currentUserId={user._id}
            selectedConversationId={selectedChat?.conversationId}
            onSelectChat={handleSelectChat}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
        />
    </Grid>

    {/* chat messages - right side */}
    <Grid size={{xs: 12,md:8}} sx={{
        height: '100%',
        display: {
            xs: selectedChat ? 'block' : 'none', md: 'block'
        }
    }}>
        {selectedChat ? (
            <Box
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    border: {xs: '0', md:'1px solid'},
                    borderColor: {md:'divider'},
                    borderRadius: {xs: 0, md: 3},
                }}
            >
                <ChatHeader
                    otherUser={selectedChat.otherUser}
                    onBack={() => setSelectedChat(null)}
                    onViewProfile={() => navigate(`/profiledashboard/${selectedChat.otherUser?._id}/profilemain`)}
                    onDeleteChat={() => {
                        deleteConversation(selectedChat.conversationId)
                        setSelectedChat(null)
                    }}
                    onBlock={() => setBlockConfirmOpen(true)}
                />

                <MessageList
                    messages={chatMessages}
                    currentUserId={user._id}
                    otherUser={selectedChat.otherUser}
                    containerRef={messageContainerRef}
                    endRef={messageEndRef}
                    isChatReady={isChatReady}
                    onScroll={handleMessagesScroll}
                    loadingOlder={loadingOlder}
                />

                <ScrollToBottomButton
                    visible={!isNearBottom}
                    hasNew={hasNewBelow}
                    onClick={() => scrollToBottom('smooth')}
                />

                <MessageInput
                    messageText={messageText}
                    setMessageText={setMessageText}
                    onSend={handleSend}
                    mediaFile={mediaFile}
                    setMediaFile={setMediaFile}
                    previewMedia={previewMedia}
                    fileInputRef={fileInputRef}
                    isEmojiOpen={isEmojiOpen}
                    setIsEmojiOpen={setIsEmojiOpen}
                    onEmojiClick={onEmojiClick}
                />
            </Box>
        ): (
            <ChatEmptyState/>
        )}
    </Grid>
</Grid>

<Snackbar
    open={!!sendError}
    autoHideDuration={5000}
    onClose={clearSendError}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
>
    <Alert severity="error" variant="filled" onClose={clearSendError} sx={{ width: '100%' }}>
        {sendError}
    </Alert>
</Snackbar>

<Snackbar
    open={!!blockToast}
    autoHideDuration={4000}
    onClose={() => setBlockToast('')}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
>
    <Alert severity="success" variant="filled" onClose={() => setBlockToast('')} sx={{ width: '100%' }}>
        {blockToast}
    </Alert>
</Snackbar>

{blockConfirmOpen && selectedChat && (
    <ConfirmationDialog
        icon={BlockIcon}
        message={`block ${selectedChat.otherUser?.name}?`}
        confirmLabel={isBlocking ? 'Blocking…' : 'Block'}
        confirmDisabled={isBlocking}
        onClose={() => setBlockConfirmOpen(false)}
        onConfirm={handleBlockConfirm}
    />
)}
</Container>
)
}
