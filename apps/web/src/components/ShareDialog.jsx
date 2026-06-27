import { useMemo, useState } from 'react';
import { Autocomplete, Avatar, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Snackbar, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import IosShareIcon from '@mui/icons-material/IosShare';
import { useUsersProvider } from '../providers/UsersProvider';
import { useAuth } from '../providers/AuthProvider';
import { getSocket } from '../services/socketService';

// Share a post two ways:
// - in-app: pick a user and send them the post via the existing chat socket
//   ('send-message'); the message body is a caption + a deep link.
// - external: native Web Share API where available, with a copy-link fallback.
// The deep link points at /allcards?card=<id>, which AllCardsPage opens as a
// modal — no separate public post page needed.
export default function ShareDialog({ card, open, onClose }) {
    const { users } = useUsersProvider();
    const { user } = useAuth();
    const [recipient, setRecipient] = useState(null);
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState('');

    const shareUrl = `${window.location.origin}/allcards?card=${card?._id}`;
    const shareText = `Check out this post${card?.title ? `: ${card.title}` : ''} ${shareUrl}`;

    // everyone but yourself
    const recipients = useMemo(
        () => users.filter((u) => u._id !== user?._id),
        [users, user]
    );

    const handleSendInApp = async () => {
        if (!recipient) return;
        const socket = getSocket();
        if (!socket) { setToast('Not connected — please try again'); return; }
        setSending(true);
        try {
            socket.emit('send-message', { toUser: recipient._id, text: shareText });
            setToast(`Shared with ${recipient.name}`);
            setRecipient(null);
        } finally {
            setSending(false);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setToast('Link copied');
        } catch {
            setToast('Could not copy link');
        }
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: card?.title || 'Mirage42 post', text: 'Check out this post', url: shareUrl });
            } catch {
                /* user dismissed the share sheet — no-op */
            }
        } else {
            handleCopyLink();
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth='xs'>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                    Share post
                    <IconButton onClick={onClose} size='small' aria-label='close'>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {/* In-app share */}
                    <Typography fontSize={13} fontWeight={600} color='text.secondary' sx={{ mb: 1 }}>
                        Send to someone
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                        <Autocomplete
                            fullWidth
                            size='small'
                            options={recipients}
                            value={recipient}
                            onChange={(e, v) => setRecipient(v)}
                            getOptionLabel={(o) => `${o.name} ${o.lastName || ''}`.trim()}
                            isOptionEqualToValue={(o, v) => o._id === v._id}
                            renderOption={(props, o) => (
                                <Box component='li' {...props} key={o._id} sx={{ display: 'flex', gap: 1 }}>
                                    <Avatar src={o.profilePicture} sx={{ width: 24, height: 24 }} />
                                    {o.name} {o.lastName}
                                </Box>
                            )}
                            renderInput={(params) => <TextField {...params} placeholder='Search people...' />}
                        />
                        <Button
                            variant='contained'
                            startIcon={<SendIcon />}
                            disabled={!recipient || sending}
                            onClick={handleSendInApp}
                            sx={{ borderRadius: 2, minWidth: 96 }}
                        >
                            Send
                        </Button>
                    </Box>

                    {/* External share */}
                    <Typography fontSize={13} fontWeight={600} color='text.secondary' sx={{ mb: 1 }}>
                        Or share externally
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            fullWidth
                            size='small'
                            value={shareUrl}
                            slotProps={{ input: { readOnly: true } }}
                        />
                        <Button
                            variant='outlined'
                            startIcon={<ContentCopyIcon />}
                            onClick={handleCopyLink}
                            sx={{ borderRadius: 2, minWidth: 96 }}
                        >
                            Copy
                        </Button>
                    </Box>
                    <Button fullWidth variant='text' startIcon={<IosShareIcon />} onClick={handleNativeShare} sx={{ mt: 1 }}>
                        Share via…
                    </Button>
                </DialogContent>
            </Dialog>
            <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')} message={toast} />
        </>
    );
}
