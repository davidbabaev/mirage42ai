import { Avatar, Box, Typography } from '@mui/material';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ImageIcon from '@mui/icons-material/Image';
import { useNavigate } from 'react-router-dom';

// A post shared into a chat, rendered as a clickable rich preview card
// (Instagram-DM style): media thumbnail + title/snippet + author. Clicking it
// opens the live post via the existing deep link (/allcards?card=<id>).
// Data comes from the server-built `sharedCard` snapshot on the message, so it
// renders instantly with no extra fetch.
export default function SharedPostCard({ sharedCard }) {
    const navigate = useNavigate();
    if (!sharedCard?.cardId) return null;

    const { cardId, title, snippet, mediaUrl, mediaType, authorName, authorAvatar } = sharedCard;
    const open = () => navigate(`/allcards?card=${cardId}`);

    return (
        <Box
            role='button'
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
            sx={{
                width: { xs: 230, md: 260 },
                maxWidth: '100%',
                bgcolor: 'background.paper',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'box-shadow 150ms ease',
                '&:hover': { boxShadow: 3 },
            }}
        >
            {/* Media thumbnail (image inline; video shown as a poster with a play badge) */}
            <Box sx={{ position: 'relative', height: 140, bgcolor: 'action.hover' }}>
                {mediaUrl && mediaType === 'image' ? (
                    <Box
                        component='img'
                        src={mediaUrl}
                        alt={title || 'Shared post'}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                ) : (
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {mediaType === 'video'
                            ? <PlayCircleIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                            : <ImageIcon sx={{ fontSize: 40, color: 'text.disabled' }} />}
                    </Box>
                )}
                {mediaUrl && mediaType === 'video' && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlayCircleIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.92)' }} />
                    </Box>
                )}
            </Box>

            {/* Text + author */}
            <Box sx={{ p: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    <Avatar src={authorAvatar} sx={{ width: 20, height: 20 }} />
                    <Typography fontSize={12} fontWeight={600} noWrap>
                        {authorName || 'Unknown'}
                    </Typography>
                </Box>
                {(title || snippet) && (
                    <Typography
                        fontSize={13}
                        color='text.secondary'
                        sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}
                    >
                        {title || snippet}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}
