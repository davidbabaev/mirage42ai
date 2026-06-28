import { useEffect, useState } from 'react';
import { Autocomplete, Avatar, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Snackbar, TextField, Typography, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import IosShareIcon from '@mui/icons-material/IosShare';
import { useAuth } from '../providers/AuthProvider';
import { getSocket } from '../services/socketService';
import { searchUsers } from '../services/apiService';
import useDebounce from '../hooks/useDebounce';

// Share a post two ways:
// - in-app: search for a person and send them the post via the chat socket
//   ('send-message'). We send only the cardId; the server builds the rich
//   preview snapshot the chat renders as a clickable card. The dialog
//   auto-closes on send (Instagram/LinkedIn style).
// - external: native Web Share API where available, with a copy-link fallback.
// The deep link points at /allcards?card=<id>, which AllCardsPage opens as a
// modal — no separate public post page needed.
export default function ShareDialog({ card, open, onClose }) {
    const { user } = useAuth();
    const [recipient, setRecipient] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState([]);
    const [searching, setSearching] = useState(false);
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState('');

    const shareUrl = `${window.location.origin}/allcards?card=${card?._id}`;

    // Debounced server-side search so the picker scales to any number of users.
    const debouncedQuery = useDebounce(inputValue, 300);
    useEffect(() => {
        const q = debouncedQuery.trim();
        if (!q) { setOptions([]); return; }
        let active = true;
        setSearching(true);
        searchUsers(q, 10)
            .then((res) => {
                if (!active) return;
                // never offer yourself as a recipient
                setOptions((res || []).filter((u) => u._id !== user?._id));
            })
            .catch(() => { if (active) setOptions([]); })
            .finally(() => { if (active) setSearching(false); });
        return () => { active = false; };
    }, [debouncedQuery, user?._id]);

    const resetAndClose = () => {
        setRecipient(null);
        setInputValue('');
        setOptions([]);
        onClose();
    };

    const handleSendInApp = async () => {
        if (!recipient || !card?._id) return;
        const socket = getSocket();
        if (!socket) { setToast('Not connected — please try again'); return; }
        setSending(true);
        try {
            // Send only the cardId — the server builds the trusted preview.
            socket.emit('send-message', { toUser: recipient._id, sharedCardId: card._id });
            setToast(`Shared with ${recipient.name}`);
            resetAndClose(); // auto-close after sending
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
            <Dialog open={open} onClose={resetAndClose} fullWidth maxWidth='xs'>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                    Share post
                    <IconButton onClick={resetAndClose} size='small' aria-label='close'>
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
                            options={options}
                            value={recipient}
                            onChange={(e, v) => setRecipient(v)}
                            inputValue={inputValue}
                            onInputChange={(e, v) => setInputValue(v)}
                            loading={searching}
                            // server already filtered — don't filter again client-side
                            filterOptions={(x) => x}
                            noOptionsText={inputValue.trim() ? 'No people found' : 'Type a name to search'}
                            getOptionLabel={(o) => `${o.name} ${o.lastName || ''}`.trim()}
                            isOptionEqualToValue={(o, v) => o._id === v._id}
                            renderOption={(props, o) => (
                                <Box component='li' {...props} key={o._id} sx={{ display: 'flex', gap: 1 }}>
                                    <Avatar src={o.profilePicture} sx={{ width: 24, height: 24 }} />
                                    {o.name} {o.lastName}
                                </Box>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder='Search people...'
                                    slotProps={{
                                        input: {
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {searching ? <CircularProgress size={16} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        },
                                    }}
                                />
                            )}
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
