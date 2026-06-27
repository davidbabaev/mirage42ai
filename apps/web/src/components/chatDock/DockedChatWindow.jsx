import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, IconButton, Snackbar, Typography } from '@mui/material';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import useConversationThread from '../../hooks/useConversationThread';
import MessageList from '../../pages/chat/components/MessageList';
import MessageInput from '../../pages/chat/components/MessageInput';
import ScrollToBottomButton from '../../pages/chat/components/ScrollToBottomButton';

// One docked chat window (desktop). Reuses the same thread logic + message
// components as the full-screen ChatPage, in a compact bottom-docked shell with
// minimize/close. Send/receive go through the existing chat socket.
export default function DockedChatWindow({ otherUser, minimized, onClose, onToggleMinimize }) {
    const navigate = useNavigate();
    const t = useConversationThread(otherUser, !minimized);

    return (
        <Box
            sx={{
                width: 320,
                height: minimized ? 'auto' : 440,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px 8px 0 0',
                boxShadow: 6,
                overflow: 'hidden',
                pointerEvents: 'auto',
            }}
        >
            {/* Header */}
            <Box
                onClick={minimized ? onToggleMinimize : undefined}
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                    borderBottom: minimized ? 'none' : '1px solid', borderColor: 'divider',
                    cursor: minimized ? 'pointer' : 'default', flex: '0 0 auto',
                }}
            >
                <Avatar
                    src={otherUser?.profilePicture}
                    sx={{ width: 32, height: 32, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/profiledashboard/${otherUser?._id}/profilemain`); }}
                />
                <Typography
                    noWrap fontWeight={600} fontSize={14}
                    sx={{ flex: 1, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/profiledashboard/${otherUser?._id}/profilemain`); }}
                >
                    {otherUser?.name} {otherUser?.lastName}
                </Typography>
                <IconButton size='small' aria-label='minimize chat' onClick={(e) => { e.stopPropagation(); onToggleMinimize(); }}>
                    <RemoveIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size='small' aria-label='close chat' onClick={(e) => { e.stopPropagation(); onClose(); }}>
                    <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>

            {!minimized && (
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <MessageList
                        messages={t.chatMessages}
                        currentUserId={t.user?._id}
                        otherUser={otherUser}
                        containerRef={t.containerRef}
                        endRef={t.endRef}
                        isChatReady={t.isChatReady}
                        onScroll={t.onScroll}
                    />

                    <ScrollToBottomButton
                        visible={!t.isNearBottom}
                        hasNew={t.hasNewBelow}
                        onClick={() => t.scrollToBottom('smooth')}
                    />

                    <MessageInput
                        messageText={t.messageText}
                        setMessageText={t.setMessageText}
                        onSend={t.handleSend}
                        mediaFile={t.mediaFile}
                        setMediaFile={t.setMediaFile}
                        previewMedia={t.previewMedia}
                        fileInputRef={t.fileInputRef}
                        isEmojiOpen={t.isEmojiOpen}
                        setIsEmojiOpen={t.setIsEmojiOpen}
                        onEmojiClick={t.onEmojiClick}
                    />
                </Box>
            )}

            <Snackbar
                open={!!t.sendError}
                autoHideDuration={5000}
                onClose={t.clearSendError}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity='error' variant='filled' onClose={t.clearSendError} sx={{ width: '100%' }}>
                    {t.sendError}
                </Alert>
            </Snackbar>
        </Box>
    );
}
