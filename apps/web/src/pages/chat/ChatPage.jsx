import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useChat from '../../hooks/useChat'
import { useAuth } from '../../providers/AuthProvider';
import { Avatar, Box, Button, Container, Grid, Icon, IconButton, InputAdornment, Menu, MenuItem, Paper, TextField, Tooltip, Typography } from '@mui/material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import getTimeAgo from '../../utils/getTimeAgo';
import MessageIcon from '@mui/icons-material/Message';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import getMessageTime from '../../utils/getMessageTime';
import VideocamIcon from '@mui/icons-material/Videocam';
import ImageIcon from '@mui/icons-material/Image';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import SendIcon from '@mui/icons-material/Send';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import { useUsersProvider } from '../../providers/UsersProvider';
import MediaDisplay from '../../components/MediaDisplay';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useUI } from '../../providers/UIProvider';
import EmojiPicker from 'emoji-picker-react';

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

    // console.log('mediaFile:', mediaFile), 'preview media:', previewMedia;
    

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

    const [anchorEl, setAnchorEl] = useState(null);

    // open the menu - store the clicked element
    const handleOpen = (e) => setAnchorEl(e.currentTarget);

    // close the menu - clear the element
    // the menu is open when anchorEl is not null
    const handleClose = () => setAnchorEl(null);


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

/*     useEffect(() => {
        const container = messageContainerRef.current;
        if(!container) return;

        // how far from the bottom is the user right now?
        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;

            // if they're within 150px of the bottom, auto-scroll
            // otherwise leave them alone (they're reading old messages)
            if(distanceFromBottom  < 800){
                messageEndRef.current?.scrollIntoView({behavior: 'smooth'})
            }
            
        }, [chatMessages,]) */
        
/*         useEffect(() =>  {
            setTimeout(()=> {
                messageEndRef?.current?.scrollIntoView({behavior: 'auto'})
            }, 200)
        }, [selectedChat]) */

    useEffect(() => {
        if(user?._id){
            handleOpenChatList();
            console.log('requesting chats for:', user?._id);
            
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
            // console.log('toUserId from URL:', toUserId)
            // console.log('users array length:', users.length)
            // console.log('found other user:', otherNewUserTo)

            setSelectedChat({
                conversationId: null,
                otherUser: otherNewUserTo
            })
        }


    }, [toUserId, conversationsList, user, users])

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
        <Paper
            elevation={0}
            sx={{
                border: {xs: '0', md: '0.5px solid'},
                borderColor: {md: 'divider'},
                borderRadius: {xs: 0, md: 3},
                overflow: 'hidden',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                pb: {xs: 8, md: 0}
            }}
        >

            {/* Header with title + search */}
            <Box sx={{
                p: 2,
                borderBottom: '0.5px solid',
                borderColor: 'divider'
            }}>
                <Typography fontWeight={500} fontSize={18}>
                    Messages
                </Typography>
{/*                 <TextField
                    fullWidth
                    size='small'
                    placeholder='Search chat'
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position='start'>
                                    <SearchIcon fontSize='small'/>
                                </InputAdornment>
                            )
                        }
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 5,
                            fontSize: 13,
                            bgcolor: 'action.hover'
                        }
                    }}
                /> */}
            </Box>


            <Box sx={{
                flex: 1,
                overflowY: 'auto'
            }}>
                {/* conversation list */}
                {conversationsList.map((chat) => {
                    // const toUserId = users.find(u => u._id === chat.toUser)
                    const otherUserId = chat.fromUser === user._id ? chat.toUser : chat.fromUser
                    const otherUser = users.find(u => u._id === otherUserId)
                    const isActive = selectedChat?.conversationId === chat._id;

                    return(
                        <Box 
                            key={chat._id}
                            onClick={() => {
                                setIsChatReady(false);
                                setSelectedChat({
                                    conversationId: chat._id,
                                    otherUser: otherUser
                                })
                                handleOpenConversation(chat._id)
                            }}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                p: 1.5,
                                cursor: 'pointer',
                                bgcolor: isActive ? 'action.selected' : 'transparent',
                                borderLeft: isActive ? '3px solid' : "3px solid transparent",
                                borderLeftColor: isActive && 'primary.main',
                                '&:hover': {bgcolor : isActive ? 'action.selected' : 'action.hover'}
                            }}
                        >
                            <Avatar
                                src={otherUser?.profilePicture}
                                sx={{
                                    width: 44,
                                    height: 44,
                                }}
                            />

                            <Box sx={{flex: 1, minWidth: 0, flexWrap: 'nowrap'}}>
                                <Typography>
                                    {otherUser?.name} {otherUser?.lastName}
                                </Typography>
                                <Typography
                                    fontSize={11} color='text.secondary'
                                >
                                    last message here..
                                </Typography>
                            </Box>

                            <Typography fontSize={11} color='text.secondary'>
                                {getTimeAgo(chat.updatedAt)}
                            </Typography>
                        </Box>
                    )
                })}
            </Box>
        </Paper>
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
                {/* Top: header with the other user's name */}
                <Box sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    p:2,
                    bgcolor: 'background.paper',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    borderRadius: '10px 10px 0px 0px'
                }}>
                    {selectedChat && (
                        <IconButton 
                            sx={{display: {xs: 'block', md:'none'}, p:0}}
                            onClick={() => setSelectedChat(null)}
                        >
                            <ArrowBackIcon/>
                        </IconButton>
                    )}
                    <Avatar
                        src= {selectedChat.otherUser?.profilePicture}
                        onClick={() => navigate(`/profiledashboard/${selectedChat.otherUser?._id}/profilemain`)}
                        sx={{
                            height: 48,
                            width: 48,
                            cursor: 'pointer'
                        }}
                    />
                    <Box sx={{ flex: 1}}>
                        <Typography>
                            {selectedChat.otherUser?.name}
                            {' '}
                            {selectedChat.otherUser?.lastName}
                        </Typography>
                        <Typography fontSize={12} color='text.secondary'>
                            {selectedChat.otherUser?.job}
                            {' ' + '󠁯ㆍ' + ' '}
                            {selectedChat.otherUser?.address.city}
                        </Typography>
                    </Box>

                    <Box>
                        <IconButton onClick={handleOpen}>
                            <MoreHorizIcon/>
                        </IconButton>
                    </Box>
                    
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                    >
                        <MenuItem onClick={() => {
                            handleClose()
                            navigate(`/profiledashboard/${selectedChat.otherUser?._id}/profilemain`)
                        }}>
                            <PersonIcon sx={{mr:1}}/> Profile
                        </MenuItem>

                        <MenuItem onClick={() => {
                            handleClose();
                            handleDeleteChat(selectedChat.conversationId)
                            setSelectedChat(null)
                        }}>
                            <DeleteIcon sx={{mr:1}}/> Delete chat
                        </MenuItem>
                    </Menu>

                </Box>

                {/* Middle: scrollable list of messages */}
                <Box 
                    ref={messageContainerRef}
                    sx={{
                        flex: 1, 
                        p: 2, 
                        overflowY: 'auto',
                        visibility: isChatReady ? 'visible' : 'hidden'
                    }}
                >
                    {chatMessages.map((message) => {

                        const isSent = user._id === message.userId;
                    // isSent === true → purple bubble, right side, no avatar
                    // isSent === false → dark bubble, left side, with the other user's avatar
                        
                        return(
                            <Box key={message._id}
                                sx={{
                                    display: 'flex',
                                    justifyContent: isSent ? 'flex-end' : 'flex-start',
                                    alignItems: 'flex-end',
                                    gap: 1,
                                    mb: 1.5
                                }}
                            >
                                {!isSent && (
                                    <Avatar
                                        src={selectedChat.otherUser?.profilePicture}
                                        sx={{
                                            width: 32,
                                            height: 32
                                        }}
                                    />
                                )}
                                {/* bubble box message */}
                                <Box
                                    sx={{
                                        bgcolor: isSent ? 'primary.main' : 'action.hover',
                                        color: isSent ? 'white' : 'text.primary',
                                        px: message.mediaUrl ? 1 : 2,
                                        py: message.mediaUrl ? 1 : 1.5,
                                        borderRadius: 4,
                                        maxWidth: '70%',
                                        // the tail
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderBottomLeftRadius: isSent ? 15 : 3,
                                        borderBottomRightRadius: !isSent ? 15 : 3,
                                        wordBreak: 'break-word'
                                    }}
                                >

                                    {/* Media (if present) */}
                                    {message.mediaUrl && (
                                        <Box sx={{
                                            mb: 1, 
                                            overflow: 'hidden'
                                        }}>
                                            <MediaDisplay
                                                mediaUrl={message.mediaUrl}
                                                mediaType={message.mediaType}
                                                style={{
                                                    width:'100%',
                                                    maxHeight: 280,
                                                    objectFit: 'cover',
                                                    display: 'block',
                                                    borderRadius: 10
                                                }}
                                            />
                                        </Box>
                                    )}




                                    <Typography 
                                        fontSize={15}
                                        lineHeight={1.4}
                                        sx={{
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {message.text}
                                    </Typography>

                                    <Typography
                                        fontSize={12}
                                        sx={{
                                            alignSelf: 'flex-end',
                                            color: isSent ? 'rgba(255, 255, 255, 0.69)' : 'text.secondary'
                                        }}
                                    >
                                        {getMessageTime(message.createdAt)}
                                    </Typography>
                                </Box>
                                
                            </Box>
                        )
                    })}
                    {/* invisble market at the bottom */}
                    <Box ref={messageEndRef}/>
                </Box>

                {/* media preview */}   
                {previewMedia && (
                    <Box sx={{position: 'relative', m:1}}>
                        
                        {/* Floating Buttons over image */}
                        <Box 
                            sx={{
                                display: 'flex', 
                                gap: 0.5,
                                position: 'absolute',
                                left: 5,
                                top: 5,
                                zIndex: 1000
                            }}>
                            <Tooltip title = "Remove Media">
                                <IconButton 
                                    onClick={() => {
                                        setMediaFile(null);
                                        fileInputRef.current.value = '';
                                    }}
                                    sx={{
                                        color: 'white',
                                        bgcolor: 'rgba(0,0,0,0.4)',
                                        borderRadius: 3,
                                        p: 0.5
                                    }}
                                >
                                        <CloseIcon/>
                                </IconButton>
                            </Tooltip>
                        </Box>
    
                        <MediaDisplay
                            mediaType={mediaFile.type.startsWith('video/') ? 'video' : 'image'}
                            mediaUrl={previewMedia}
                            style={{
                                maxWidth: 200,
                                maxHeight: 150,
                                borderRadius: '10px',
                                objectFit: 'cover',
                                display: 'block'
                            }}
                        />
                    </Box>
                )}

                {/* Bottom: text input + send button */}
                <Box 
                    sx={{
                        p: 2, 
                        display: 'flex', 
                        gap: 1, 
                        alignItems: 'center',
                        borderTop: '0.5px solid',
                        borderColor: 'divider'
                    }}
                >
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/*,video/*'
                        onChange={(e) => setMediaFile(e.target.files[0])}
                        style={{display: 'none'}}
                    />

                    <IconButton
                        sx={{p:0.3}}
                        onClick={() => {
                            fileInputRef.current.accept = 'image/*';
                            fileInputRef.current.click();
                        }}
                    >
                        <ImageIcon sx={{color: 'text.secondary'}}/>
                    </IconButton>

                    <IconButton
                        sx={{p:0.3}}
                        onClick={() => {
                            fileInputRef.current.accept = 'video/*';
                            fileInputRef.current.click();
                        }}
                    >
                        <VideocamIcon sx={{color: 'text.secondary'}}/>
                    </IconButton>

                    <TextField
                        fullWidth
                        size='small'
                        multiline
                        maxRows={10}
                        placeholder='Write a message...'
                        onChange={(e) => setMessageText(e.target.value)}
                        value={messageText}
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey && messageText.trim()){
                                e.preventDefault()
                                handleSend()
                            }}
                            }
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment 
                                        position='start'
                                        sx={{
                                            alignSelf: 'flex-end',
                                            cursor: 'pointer',
                                            display: {xs: 'none', md: 'flex'}
                                        }}
                                    >
                                        <IconButton onClick={() => {
                                            setIsEmojiOpen(!isEmojiOpen)
                                        }}>
                                            <EmojiEmotionsIcon/>
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 5,
                                fontSize: 15,
                                bgcolor: 'action.hover',
                                '& fieldset': {border: 'none'}
                            }
                        }}
                    />
                    {isEmojiOpen && (
                        <Box sx={{
                            position: 'fixed',  
                            bottom: '80px', 
                            left: {xs: 0,md:'50%'},
                            zIndex: 1050, 
                            transform: 'translateX(-50)', 
                            display: {xs: 'none', md: 'block'
                        }}}>
                            <EmojiPicker
                                onEmojiClick={onEmojiClick}
                            />
                        </Box>
                    )}
                    <IconButton 
                        disabled={!messageText.trim() && !mediaFile}
                        onClick={handleSend}
                        sx={{
                            bgcolor: 'primary.main',
                            color: 'white',
                            flexShrink: 0,
                            '&:hover': {
                                bgcolor: 'primary.dark'
                            },
                            '&.Mui-disabled': {bgcolor: 'action.disabledBackground'}
                        }}
                    >
                        <SendIcon/>
                    </IconButton>
                </Box>
            </Box>
        ): (
            <Box
                sx={{
                    height: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    p: 4
                }}
            >
                <Box sx={{
                    borderRadius: '50%',
                    bgcolor: '#7F77DD20',
                    width: 90,
                    height: 90,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <MessageIcon sx={{
                        fontSize: 50,
                        color: 'primary.main'
                    }}/>    
                </Box>
                <Typography fontWeight={700} fontSize={20}>Your Messages</Typography>
                <Typography 
                    fontSize={14} 
                    textAlign={'center'} 
                    maxWidth={320}
                    lineHeight={1.2}
                    color='text.secondary'
                >
                    Select a conversation to start chatting, or message someone new from their profile.
                </Typography>
            </Box>
        )}
    </Grid>
</Grid>
</Container>
)
}
