import { Avatar, Badge, Box, Paper, Typography } from '@mui/material';
import getTimeAgo from '../../../utils/getTimeAgo';
import { usePresence } from '../../../providers/PresenceProvider';
import OnlineBadge from '../../../components/OnlineBadge';

// Build the list preview from the denormalized lastMessage: media gets an icon,
// and your own last message is prefixed with "You:".
function previewText(lastMessage, currentUserId) {
    if (!lastMessage) return 'No messages yet';
    const body = lastMessage.mediaType === 'image' ? '📷 Photo'
        : lastMessage.mediaType === 'video' ? '🎥 Video'
        : (lastMessage.text || '');
    const mine = lastMessage.senderId && String(lastMessage.senderId) === String(currentUserId);
    return mine ? `You: ${body}` : body;
}

// Left pane: list of conversations. Selecting one is delegated to the parent
// via onSelectChat(chat, otherUser).
export default function ConversationList({
    conversationsList,
    users,
    currentUserId,
    selectedConversationId,
    onSelectChat,
}) {
    const { isOnline } = usePresence();
    return (
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
            </Box>

            <Box sx={{
                flex: 1,
                overflowY: 'auto'
            }}>
                {/* conversation list */}
                {conversationsList.map((chat) => {
                    const otherUserId = chat.fromUser === currentUserId ? chat.toUser : chat.fromUser
                    const otherUser = users.find(u => u._id === otherUserId)
                    const isActive = selectedConversationId === chat._id;
                    const unread = chat.unreadCount || 0;
                    const hasUnread = unread > 0;

                    return(
                        <Box
                            key={chat._id}
                            onClick={() => onSelectChat(chat, otherUser)}
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
                            <OnlineBadge online={isOnline(otherUser?._id)}>
                                <Avatar
                                    src={otherUser?.profilePicture}
                                    sx={{
                                        width: 44,
                                        height: 44,
                                    }}
                                />
                            </OnlineBadge>

                            <Box sx={{flex: 1, minWidth: 0}}>
                                <Typography noWrap fontWeight={hasUnread ? 700 : 400}>
                                    {otherUser?.name} {otherUser?.lastName}
                                </Typography>
                                <Typography
                                    noWrap
                                    fontSize={12}
                                    color={hasUnread ? 'text.primary' : 'text.secondary'}
                                    fontWeight={hasUnread ? 600 : 400}
                                >
                                    {previewText(chat.lastMessage, currentUserId)}
                                </Typography>
                            </Box>

                            <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5}}>
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
                    )
                })}
            </Box>
        </Paper>
    );
}
