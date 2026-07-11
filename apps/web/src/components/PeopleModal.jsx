import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import useFollowUser from '../hooks/useFollowUser';

const PAGE = 8;
// A just-followed suggestion lingers in the list this long before leaving, so
// the row doesn't vanish the instant you tap Follow (LinkedIn-style).
const FOLLOW_LINGER_MS = 5000;

// Reusable "people" modal used for both the suggested list and the mutual list.
// - mode='suggested': following someone keeps them ~5s, then removes them.
// - mode='mutual': following never removes (mutuals stay).
// Scroll-paginates (PAGE at a time) and users click through to their profile.
export default function PeopleModal({ open, onClose, title, users = [], mode = 'suggested' }) {
    const navigate = useNavigate();
    const { toggleFollow, isFollowByMe, getFollowersCount } = useFollowUser();
    const [items, setItems] = useState([]);
    const [visible, setVisible] = useState(PAGE);
    const lingerTimers = useRef(new Map());

    // Snapshot the list when the modal opens so a follow doesn't instantly
    // recompute it away — removal is controlled by the linger timer instead.
    useEffect(() => {
        if (open) {
            setItems(users);
            setVisible(PAGE);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => () => {
        lingerTimers.current.forEach((t) => clearTimeout(t));
        lingerTimers.current.clear();
    }, []);

    const remove = (id) => setItems((prev) => prev.filter((u) => u._id !== id));

    const handleFollow = async (u) => {
        await toggleFollow(u._id);
        if (mode === 'suggested' && !lingerTimers.current.has(u._id)) {
            const t = setTimeout(() => {
                remove(u._id);
                lingerTimers.current.delete(u._id);
            }, FOLLOW_LINGER_MS);
            lingerTimers.current.set(u._id, t);
        }
    };

    const goTo = (id) => { navigate(`/profiledashboard/${id}/profilemain`); onClose(); };

    const onScroll = (e) => {
        const el = e.currentTarget;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
            setVisible((v) => (v < items.length ? v + PAGE : v));
        }
    };

    const shown = items.slice(0, visible);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {title}
                <IconButton size='small' aria-label='close' onClick={onClose}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers onScroll={onScroll} sx={{ maxHeight: '70vh' }}>
                {shown.length === 0 && (
                    <Typography color='text.secondary' fontSize={14} sx={{ py: 2 }}>No people to show.</Typography>
                )}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    {shown.map((u) => {
                        const following = isFollowByMe(u._id);
                        return (
                            <Box key={u._id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0.5 }}>
                                <IconButton size='small' aria-label='dismiss person' onClick={() => remove(u._id)} sx={{ position: 'absolute', top: 4, right: 4 }}>
                                    <CloseIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                <Avatar src={u.profilePicture} sx={{ width: 64, height: 64, cursor: 'pointer' }} onClick={() => goTo(u._id)} />
                                <Typography noWrap fontWeight={600} fontSize={14} sx={{ cursor: 'pointer', maxWidth: '100%' }} onClick={() => goTo(u._id)}>
                                    {u.name} {u.lastName}
                                </Typography>
                                <Typography noWrap fontSize={12} color='text.secondary' sx={{ maxWidth: '100%' }}>{u.job}</Typography>
                                <Typography fontSize={11} color='text.secondary'>{getFollowersCount(u)} followers</Typography>
                                <Button
                                    fullWidth
                                    size='small'
                                    variant={following ? 'outlined' : 'contained'}
                                    color={following ? 'inherit' : 'primary'}
                                    startIcon={!following && <PersonAddIcon />}
                                    onClick={() => handleFollow(u)}
                                    sx={{ borderRadius: 5, mt: 0.5, fontSize: 11 }}
                                >
                                    {following ? 'Following' : 'Follow'}
                                </Button>
                            </Box>
                        );
                    })}
                </Box>
                {visible < items.length && (
                    <Button fullWidth onClick={() => setVisible((v) => v + PAGE)} sx={{ mt: 2 }}>Load more</Button>
                )}
            </DialogContent>
        </Dialog>
    );
}
