import { useState } from 'react';
import { Avatar, Badge, Box, Paper, Typography } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useChatDock } from '../../providers/ChatDockProvider';
import { useChatList } from '../../providers/ChatProvider';
import { useAuth } from '../../providers/AuthProvider';
import { usePresence } from '../../providers/PresenceProvider';
import OnlineBadge from '../OnlineBadge';
import InfiniteScroll from '../InfiniteScroll';
import getTimeAgo from '../../utils/getTimeAgo';

// Preview line for a conversation row (mirrors ConversationList): media → icon,
// own last message prefixed with "You:".
function previewText(lastMessage, currentUserId) {
    if (!lastMessage) return 'No messages yet';
    const body = lastMessage.mediaType === 'image' ? '📷 Photo'
        : lastMessage.mediaType === 'video' ? '🎥 Video'
        : (lastMessage.text || '');
    const mine = lastMessage.senderId && String(lastMessage.senderId) === String(currentUserId);
    return mine ? `You: ${body}` : body;
}

// The persistent LinkedIn-style "Messaging" bar pinned bottom-right. Always shows
// its header; expands to a scrollable list of all conversations (with presence
// dots). Clicking a conversation opens the single docked chat window.
export default function MessagingBar() {
    const { openChat, openUser, barOpen, toggleBar } = useChatDock();
    const { conversations, totalUnread, hasMore, loadingMore, loadMore } = useChatList();
    const { user } = useAuth();
    const { isOnline } = usePresence();

    const currentUserId = user?._id;
    // The dock list scrolls inside its own 360px box — make that the observer root.
    const [scrollEl, setScrollEl] = useState(null);

    return (
        <Paper
            elevation={6}
            sx={{
                width: 300,
                borderRadius: '8px 8px 0 0',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header — click to collapse/expand the list */}
            <Box
                onClick={toggleBar}
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25,
                    cursor: 'pointer', flex: '0 0 auto',
                    borderBottom: barOpen ? '1px solid' : 'none', borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                }}
            >
                <Typography fontWeight={600} fontSize={15} sx={{ flex: 1 }}>
                    Messaging
                </Typography>
                {totalUnread > 0 && (
                    <Badge
                        badgeContent={totalUnread}
                        color='error'
                        sx={{ mr: 1, '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
                    />
                )}
                {barOpen ? <ExpandMoreIcon fontSize='small' /> : <ExpandLessIcon fontSize='small' />}
            </Box>

            {barOpen && (
                <Box ref={setScrollEl} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                    <InfiniteScroll
                        hasMore={hasMore}
                        loadingMore={loadingMore}
                        onLoadMore={loadMore}
                        isEmpty={conversations.length === 0}
                        root={scrollEl}
                        showEnd={false}
                        emptyState={(
                            <Typography color='text.secondary' fontSize={14} sx={{ p: 2, textAlign: 'center' }}>
                                No conversations yet
                            </Typography>
                        )}
                    >
                        {conversations.map((chat) => {
                            // Partner is embedded on the conversation by the server (no global users scan).
                            const otherUser = chat.otherUser;
                            if (!otherUser) return null; // hidden (e.g. blocked) — skip
                            const unread = chat.unreadCount || 0;
                            const hasUnread = unread > 0;
                            const isActive = openUser?._id === otherUser._id;

                            return (
                                <Box
                                    key={chat._id}
                                    onClick={() => openChat(otherUser)}
                                    sx={{
                                        display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1,
                                        cursor: 'pointer',
                                        bgcolor: isActive ? 'action.selected' : 'transparent',
                                        '&:hover': { bgcolor: isActive ? 'action.selected' : 'action.hover' },
                                    }}
                                >
                                    <OnlineBadge online={isOnline(otherUser._id)}>
                                        <Avatar src={otherUser.profilePicture} sx={{ width: 36, height: 36 }} />
                                    </OnlineBadge>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography noWrap fontSize={14} fontWeight={hasUnread ? 700 : 500} sx={{ textTransform: 'capitalize' }}>
                                            {otherUser.name} {otherUser.lastName}
                                        </Typography>
                                        <Typography
                                            noWrap fontSize={12}
                                            color={hasUnread ? 'text.primary' : 'text.secondary'}
                                            fontWeight={hasUnread ? 600 : 400}
                                        >
                                            {previewText(chat.lastMessage, currentUserId)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                        <Typography fontSize={11} color={hasUnread ? 'primary.main' : 'text.secondary'}>
                                            {getTimeAgo(chat.updatedAt)}
                                        </Typography>
                                        {hasUnread && (
                                            <Badge
                                                badgeContent={unread}
                                                color='error'
                                                sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
                                            />
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </InfiniteScroll>
                </Box>
            )}
        </Paper>
    );
}
