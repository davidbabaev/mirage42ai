import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useChat from '../../hooks/useChat'
import { useAuth } from '../../providers/AuthProvider';
import { Box, Container, Grid } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUsersProvider } from '../../providers/UsersProvider';
import { useUI } from '../../providers/UIProvider';
import ConversationList from './components/ConversationList';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import ChatEmptyState from './components/ChatEmptyState';

export default function ChatPage() {

    const [selectedChat, setSelectedChat] = useState(null);
    const [messageText, setMessageText] = useState('');
    const navigate = useNavigate();
    const {user} = useAuth();
    const {users} = useUsersProvider();
    const {setIsChatOpen} = useUI();

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
        handleOpenChatList,
        handleOpenConversation,
        handleSendNewMessage,
        conversationsList,
        chatMessages,
        handleDeleteChat
    } = useChat(
        selectedChat?.conversationId,
        handleConversationDeleted,
        handleMessageReceived
    );

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

    useEffect(() => {
        if(chatMessages.length === 0) return;

        // jump to bottom (still invisible because isChatReady is false)
        messageEndRef.current?.scrollIntoView({behavior: 'auto'})

        // wait one paint frame, then reveal
        requestAnimationFrame(() => {
            setIsChatReady(true)
        })

    }, [chatMessages])

    useEffect(() => {
        setMessageText('');
    }, [selectedChat?.conversationId])

    useEffect(() => {
        if(user?._id){
            handleOpenChatList();
        }
    }, [user?._id]);

    const [searchParams, setSearchParams] = useSearchParams();
    const toUserId = searchParams.get('to')

    useEffect(() => {
        if(!toUserId){
            return;
        }

        // wait until we have data before deciding
        if(users.length === 0) return;

        const conversation = conversationsList.find(c =>
            (c.fromUser === user._id && c.toUser === toUserId) ||
            (c.fromUser === toUserId && c.toUser === user._id)
        )

        if(conversation){
            const otherUserTo = users.find(u => u._id === toUserId)

            setIsChatReady(false);

            setSelectedChat({
                conversationId: conversation._id,
                otherUser: otherUserTo
            })

            handleOpenConversation(conversation._id)
            setSearchParams({}, {replace: true})
        }
        else{
            const otherNewUserTo = users.find(u => u._id === toUserId);

            setSelectedChat({
                conversationId: null,
                otherUser: otherNewUserTo
            })
        }


    }, [toUserId, conversationsList, user, users])

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
            conversationsList={conversationsList}
            users={users}
            currentUserId={user._id}
            selectedConversationId={selectedChat?.conversationId}
            onSelectChat={handleSelectChat}
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
                        handleDeleteChat(selectedChat.conversationId)
                        setSelectedChat(null)
                    }}
                />

                <MessageList
                    messages={chatMessages}
                    currentUserId={user._id}
                    otherUser={selectedChat.otherUser}
                    containerRef={messageContainerRef}
                    endRef={messageEndRef}
                    isChatReady={isChatReady}
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
</Container>
)
}
