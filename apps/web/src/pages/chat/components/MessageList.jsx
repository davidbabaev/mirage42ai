import { Avatar, Box, Typography } from '@mui/material';
import MediaDisplay from '../../../components/MediaDisplay';
import getMessageTime from '../../../utils/getMessageTime';

// Scrollable message area. Bubbles aligned by sender; the parent owns the
// container/end refs and the ready-to-reveal flag.
export default function MessageList({ messages, currentUserId, otherUser, containerRef, endRef, isChatReady }) {
    return (
        <Box
            ref={containerRef}
            sx={{
                flex: 1,
                p: 2,
                overflowY: 'auto',
                visibility: isChatReady ? 'visible' : 'hidden'
            }}
        >
            {messages.map((message) => {
                const isSent = currentUserId === message.userId;
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
                                src={otherUser?.profilePicture}
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
            <Box ref={endRef}/>
        </Box>
    );
}
