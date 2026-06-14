import { Avatar, Box, Paper, Typography } from '@mui/material';
import getTimeAgo from '../../../utils/getTimeAgo';

// Left pane: list of conversations. Selecting one is delegated to the parent
// via onSelectChat(chat, otherUser).
export default function ConversationList({
    conversationsList,
    users,
    currentUserId,
    selectedConversationId,
    onSelectChat,
}) {
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
    );
}
