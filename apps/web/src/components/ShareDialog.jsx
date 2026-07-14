import { useEffect, useState } from 'react';
import { Avatar, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, List, ListItemAvatar, ListItemButton, ListItemText, Snackbar, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import IosShareIcon from '@mui/icons-material/IosShare';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '../providers/authContext';
import { getSocket } from '../services/socketService';
import { searchUsers, getRecentContacts } from '../services/apiService';
import useDebounce from '../hooks/useDebounce';

// Share a post two ways:
// - in-app: opening the dialog shows your recent DM contacts; typing switches to
//   a server-side people search. Pick someone and send the post via the chat
//   socket ('send-message') — we send only the cardId; the server builds the
//   trusted preview snapshot the chat renders as a clickable card. Auto-closes
//   on send (Instagram-style).
// - external: native Web Share API where available, with a copy-link fallback.
// The deep link points at /allcards?card=<id>, which AllCardsPage opens as a
// modal — no separate public post page needed.
export default function ShareDialog({ card, open, onClose }) {
    const { user } = useAuth();
    const [recipient, setRecipient] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [recent, setRecent] = useState([]);
    const [loadingRecent, setLoadingRecent] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState('');

    // External/outbound link points at the API's server-rendered OG route so
    // social crawlers get a rich preview; it redirects humans to the SPA card.
    // (In-app card clicks keep using the SPA deep link.)
    const shareUrl = `${import.meta.env.VITE_API_URL}/s/card/${card?._id}`;
    const query = inputValue.trim();

    // On open, load recent contacts as the default list.
    useEffect(() => {
        if (!open) return;
        let active = true;
        // Async fetch kickoff: arms the spinner before the promise resolves.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoadingRecent(true);
        getRecentContacts(10)
            .then((res) => { if (active) setRecent((res || []).filter((u) => u._id !== user?._id)); })
            .catch(() => { if (active) setRecent([]); })
            .finally(() => { if (active) setLoadingRecent(false); });
        return () => { active = false; };
    }, [open, user?._id]);

    // Debounced server-side search; scales to any number of users.
    const debouncedQuery = useDebounce(query, 300);
    useEffect(() => {
        // Sync clear: immediately empties stale results when the query is cleared.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!debouncedQuery) { setSearchResults([]); return; }
        let active = true;
        setSearching(true);
        searchUsers(debouncedQuery, 10)
            .then((res) => { if (active) setSearchResults((res || []).filter((u) => u._id !== user?._id)); })
            .catch(() => { if (active) setSearchResults([]); })
            .finally(() => { if (active) setSearching(false); });
        return () => { active = false; };
    }, [debouncedQuery, user?._id]);

    // Typing → search results; empty box → recent contacts.
    const list = query ? searchResults : recent;
    const listLoading = query ? searching : loadingRecent;

    const resetAndClose = () => {
        setRecipient(null);
        setInputValue('');
        setSearchResults([]);
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
                    <TextField
                        fullWidth
                        size='small'
                        placeholder='Search other people'
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        slotProps={{
                            input: {
                                endAdornment: searching ? <CircularProgress size={16} /> : null,
                            },
                        }}
                    />

                    <List sx={{ height: 240, overflowY: 'auto', mt: 0.5 }} dense>
                        {listLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : list.length === 0 ? (
                            <Typography color='text.secondary' fontSize={14} sx={{ p: 2, textAlign: 'center' }}>
                                {query ? 'No people found' : 'No recent chats — search for someone'}
                            </Typography>
                        ) : (
                            list.map((u) => {
                                const selected = recipient?._id === u._id;
                                return (
                                    <ListItemButton key={u._id} selected={selected} onClick={() => setRecipient(u)} sx={{ borderRadius: 1.5 }}>
                                        <ListItemAvatar sx={{ minWidth: 44 }}>
                                            <Avatar src={u.profilePicture} sx={{ width: 36, height: 36 }} />
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={`${u.name || ''} ${u.lastName || ''}`.trim() || u.displayName || 'User'}
                                            slotProps={{ primary: { sx: { textTransform: 'capitalize' } } }}
                                        />
                                        {selected && <CheckCircleIcon color='primary' fontSize='small' />}
                                    </ListItemButton>
                                );
                            })
                        )}
                    </List>

                    <Button
                        fullWidth
                        variant='contained'
                        startIcon={<SendIcon />}
                        disabled={!recipient || sending}
                        onClick={handleSendInApp}
                        sx={{ borderRadius: 2, mt: 1, mb: 3 }}
                    >
                        {recipient ? `Send to ${recipient.name}` : 'Send'}
                    </Button>

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
