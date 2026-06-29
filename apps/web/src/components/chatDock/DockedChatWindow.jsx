import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, IconButton, Menu, MenuItem, Snackbar, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import useConversationThread from '../../hooks/useConversationThread';
import { usePresence } from '../../providers/PresenceProvider';
import { useAuth } from '../../providers/AuthProvider';
import useBlockUser from '../../hooks/useBlockUser';
import ConfirmationDialog from '../ConfirmationDialog';
import OnlineBadge from '../OnlineBadge';
import MessageList from '../../pages/chat/components/MessageList';
import MessageInput from '../../pages/chat/components/MessageInput';
import ScrollToBottomButton from '../../pages/chat/components/ScrollToBottomButton';

// The single docked chat window (desktop), opened to the LEFT of the Messaging
// bar. Reuses the same thread logic + message components as the full-screen
// ChatPage in a comfortably-sized bottom-docked shell. Closing returns the user
// to the bar (the conversation stays in the list).
export default function DockedChatWindow({ otherUser, onClose }) {
    const navigate = useNavigate();
    const { isOnline } = usePresence();
    const { user } = useAuth();
    const { toggleBlock } = useBlockUser();
    const t = useConversationThread(otherUser, true);

    // ⋯ overflow menu state
    const [menuAnchor, setMenuAnchor] = useState(null);
    const openMenu = (e) => setMenuAnchor(e.currentTarget);
    const closeMenu = () => setMenuAnchor(null);

    // Block flow
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);

    const handleBlockConfirm = async () => {
        const otherId = otherUser?._id;
        if (!otherId || otherId === user?._id) return;
        setIsBlocking(true);
        try {
            const result = await toggleBlock(otherId);
            if (result) {
                setBlockConfirmOpen(false);
                onClose();
            }
        } finally {
            setIsBlocking(false);
        }
    };

    const goToProfile = (e) => {
        e.stopPropagation();
        navigate(`/profiledashboard/${otherUser?._id}/profilemain`);
    };

    return (
        <Box
            sx={{
                width: 384,
                height: 560,
                maxHeight: 'calc(100vh - 24px)',
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
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                    borderBottom: '1px solid', borderColor: 'divider', flex: '0 0 auto',
                }}
            >
                <OnlineBadge online={isOnline(otherUser?._id)}>
                    <Avatar
                        src={otherUser?.profilePicture}
                        sx={{ width: 36, height: 36, cursor: 'pointer' }}
                        onClick={goToProfile}
                    />
                </OnlineBadge>
                <Typography
                    noWrap fontWeight={600} fontSize={15}
                    sx={{ flex: 1, cursor: 'pointer', textTransform: 'capitalize' }}
                    onClick={goToProfile}
                >
                    {otherUser?.name} {otherUser?.lastName}
                </Typography>
                <IconButton size='small' aria-label='More options' onClick={openMenu}>
                    <MoreHorizIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <IconButton size='small' aria-label='close chat' onClick={onClose}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
            </Box>

            {/* Overflow menu */}
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
                <MenuItem onClick={() => { closeMenu(); navigate(`/profiledashboard/${otherUser?._id}/profilemain`); }}>
                    <PersonIcon sx={{ mr: 1 }} /> Profile
                </MenuItem>
                <MenuItem onClick={() => { closeMenu(); t.deleteConversation(t.conversationId); onClose(); }}>
                    <DeleteIcon sx={{ mr: 1 }} /> Delete chat
                </MenuItem>
                <MenuItem
                    sx={{ color: 'error.main' }}
                    onClick={() => { closeMenu(); setBlockConfirmOpen(true); }}
                >
                    <BlockIcon sx={{ mr: 1 }} /> Block user
                </MenuItem>
            </Menu>

            {/* Block confirmation */}
            {blockConfirmOpen && (
                <ConfirmationDialog
                    icon={BlockIcon}
                    message={`block ${otherUser?.name}?`}
                    confirmLabel={isBlocking ? 'Blocking…' : 'Block'}
                    confirmDisabled={isBlocking}
                    onClose={() => setBlockConfirmOpen(false)}
                    onConfirm={handleBlockConfirm}
                />
            )}

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
