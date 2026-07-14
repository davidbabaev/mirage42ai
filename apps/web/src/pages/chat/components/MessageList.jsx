import { useState } from 'react';
import { Avatar, Box, Chip, CircularProgress, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MediaDisplay from '../../../components/MediaDisplay';
import ChatImageViewer from '../../../components/ChatImageViewer';
import SharedPostCard from './SharedPostCard';
import getMessageTime from '../../../utils/getMessageTime';

const GROUP_GAP_MS = 5 * 60 * 1000; // messages within 5 min from the same sender group together
const AVATAR = 32;
const AVATAR_GAP = 8;

const sameDay = (a, b) => {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear()
        && da.getMonth() === db.getMonth()
        && da.getDate() === db.getDate();
};

function dayLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Scrollable message area: WhatsApp/IG-style grouped bubbles + day separators.
// The parent owns the container/end refs, scroll tracking, and the reveal flag.
export default function MessageList({ messages, currentUserId, otherUser, containerRef, endRef, isChatReady, onScroll, loadingOlder }) {
    const [viewerSrc, setViewerSrc] = useState(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const openViewer = (url) => { setViewerSrc(url); setViewerOpen(true); };
    const closeViewer = () => setViewerOpen(false);

    return (
        <>
        <Box
            ref={containerRef}
            onScroll={onScroll}
            sx={(theme) => ({
                flex: 1,
                px: { xs: 1.5, md: 2 },
                py: 2,
                overflowY: 'auto',
                visibility: isChatReady ? 'visible' : 'hidden',
                // Subtle, theme-aware chat wallpaper (Telegram/WhatsApp style):
                // a soft tinted base with a faint dotted pattern behind the bubbles.
                backgroundColor: theme.palette.mode === 'dark' ? '#0c1015' : '#f4f2fb',
                backgroundImage: `radial-gradient(${
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(127,119,221,0.12)'
                } 1.3px, transparent 1.3px)`,
                backgroundSize: '22px 22px',
            })}
        >
            {loadingOlder && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                    <CircularProgress size={22} />
                </Box>
            )}
            {messages.map((message, i) => {
                const isSent = currentUserId === message.userId;
                const hasCard = !!message.sharedCard?.cardId;
                const prev = messages[i - 1];
                const next = messages[i + 1];

                const showDate = i === 0 || !sameDay(prev.createdAt, message.createdAt);

                const lastOfGroup = i === messages.length - 1
                    || next.userId !== message.userId
                    || !sameDay(next.createdAt, message.createdAt)
                    || (new Date(next.createdAt) - new Date(message.createdAt)) > GROUP_GAP_MS;

                // received avatar appears once, on the group's last bubble
                const showAvatar = !isSent && lastOfGroup;
                const needsAvatarSpacer = !isSent && !lastOfGroup;

                // Image messages (not video, not sending/failed) are tappable to
                // open the fullscreen viewer. Videos and in-flight/failed uploads
                // are excluded — a failed upload may not be a complete image.
                const isZoomable = !!message.mediaUrl
                    && message.mediaType !== 'video'
                    && message.status !== 'sending'
                    && message.status !== 'failed';

                return (
                    <Box key={message._id}>
                        {showDate && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
                                <Chip
                                    label={dayLabel(message.createdAt)}
                                    size="small"
                                    sx={{ bgcolor: 'action.hover', color: 'text.secondary', fontSize: 11 }}
                                />
                            </Box>
                        )}

                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: isSent ? 'flex-end' : 'flex-start',
                                alignItems: 'flex-end',
                                gap: `${AVATAR_GAP}px`,
                                mb: lastOfGroup ? 1.5 : 0.3,
                                ml: needsAvatarSpacer ? `${AVATAR + AVATAR_GAP}px` : 0,
                            }}
                        >
                            {showAvatar && (
                                <Avatar src={otherUser?.profilePicture} sx={{ width: AVATAR, height: AVATAR }} />
                            )}

                            <Box
                                sx={{
                                    bgcolor: isSent ? 'primary.main' : 'action.hover',
                                    color: isSent ? 'white' : 'text.primary',
                                    px: (message.mediaUrl || hasCard) ? 1 : 1.75,
                                    py: (message.mediaUrl || hasCard) ? 1 : 1.25,
                                    borderRadius: 2.5,
                                    maxWidth: { xs: '78%', md: '65%' },
                                    display: 'flex',
                                    flexDirection: 'column',
                                    // tail only on the group's last bubble
                                    borderBottomRightRadius: isSent && lastOfGroup ? 2 : 2.5,
                                    borderBottomLeftRadius: !isSent && lastOfGroup ? 2 : 2.5,
                                    wordBreak: 'break-word'
                                }}
                            >
                                {message.mediaUrl && (
                                    <Box
                                        {...(isZoomable ? {
                                            role: 'button',
                                            tabIndex: 0,
                                            'aria-label': 'View full-size image',
                                            onClick: () => openViewer(message.mediaUrl),
                                            onKeyDown: (e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    openViewer(message.mediaUrl);
                                                }
                                            },
                                        } : {})}
                                        sx={{
                                            mb: message.text ? 0.75 : 0,
                                            overflow: 'hidden',
                                            position: 'relative',
                                            ...(isZoomable && { cursor: 'zoom-in' }),
                                        }}
                                    >
                                        <MediaDisplay
                                            mediaUrl={message.mediaUrl}
                                            mediaType={message.mediaType}
                                            style={{
                                                width: '100%',
                                                maxHeight: 280,
                                                objectFit: 'cover',
                                                display: 'block',
                                                borderRadius: 10,
                                                opacity: (message.status === 'sending' || message.status === 'failed') ? 0.55 : 1
                                            }}
                                        />
                                        {message.status === 'sending' && (
                                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <CircularProgress size={30} sx={{ color: '#fff' }} />
                                            </Box>
                                        )}
                                        {message.status === 'failed' && (
                                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.35)', borderRadius: '10px' }}>
                                                <ErrorOutlineIcon sx={{ color: '#fff' }} />
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                {hasCard && (
                                    <Box sx={{ mb: message.text ? 0.75 : 0 }}>
                                        <SharedPostCard sharedCard={message.sharedCard} />
                                    </Box>
                                )}

                                {message.text && (
                                    <Typography fontSize={15} lineHeight={1.4} sx={{ whiteSpace: 'pre-wrap' }}>
                                        {message.text}
                                    </Typography>
                                )}

                                <Typography
                                    fontSize={11}
                                    sx={{
                                        alignSelf: 'flex-end',
                                        mt: 0.25,
                                        color: message.status === 'failed'
                                            ? '#ffb4a8'
                                            : (isSent ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary')
                                    }}
                                >
                                    {message.status === 'sending'
                                        ? 'Sending…'
                                        : message.status === 'failed'
                                            ? 'Not sent'
                                            : getMessageTime(message.createdAt)}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                );
            })}
            {/* invisible marker at the bottom */}
            <Box ref={endRef} />
        </Box>

        {/* Fullscreen image viewer — renders in a Portal so it sits outside the
            scroll container. Mounts per-conversation; Dialog content unmounts on
            close so ZoomableImage zoom resets each time. */}
        <ChatImageViewer src={viewerSrc} open={viewerOpen} onClose={closeViewer} />
        </>
    );
}
