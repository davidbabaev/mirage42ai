import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Avatar, Box, Button, Dialog, DialogContent, DialogTitle,
    IconButton, Skeleton, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import useFollowUser from '../hooks/useFollowUser';
import { useAuth } from '../providers/AuthProvider';
import { getCardLikes } from '../services/apiService';

const LIMIT = 20;

// Modal that lists users who liked a card. Fetches from GET /cards/:id/likes
// with server-side cursor pagination so it scales to arbitrarily large like
// counts without loading everything at once.
export default function LikesModal({ open, onClose, cardId, likeCount }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toggleFollow, isFollowByMe, getFollowersCount } = useFollowUser();

    const [users, setUsers] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [followPending, setFollowPending] = useState(new Set());

    // Reset and load the first page whenever the modal opens.
    useEffect(() => {
        if (!open || !cardId) return;
        setUsers([]);
        setNextCursor(null);
        setHasMore(false);
        setError(null);
        setLoading(true);
        getCardLikes(cardId, undefined, LIMIT)
            .then((data) => {
                setUsers(data.users ?? []);
                setNextCursor(data.nextCursor ?? null);
                setHasMore(!!data.nextCursor);
            })
            .catch((e) => setError(e.message || 'Failed to load likes'))
            .finally(() => setLoading(false));
    }, [open, cardId]);

    const loadMore = useCallback(() => {
        if (loading || !hasMore) return;
        setLoading(true);
        getCardLikes(cardId, nextCursor, LIMIT)
            .then((data) => {
                setUsers((prev) => [...prev, ...(data.users ?? [])]);
                setNextCursor(data.nextCursor ?? null);
                setHasMore(!!data.nextCursor);
            })
            .catch((e) => setError(e.message || 'Failed to load more'))
            .finally(() => setLoading(false));
    }, [cardId, loading, hasMore, nextCursor]);

    const handleScroll = (e) => {
        const el = e.currentTarget;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
            loadMore();
        }
    };

    const handleFollow = async (userId) => {
        setFollowPending((p) => new Set(p).add(userId));
        try {
            await toggleFollow(userId);
        } finally {
            setFollowPending((p) => { const n = new Set(p); n.delete(userId); return n; });
        }
    };

    const goTo = (id) => { navigate(`/profiledashboard/${id}/profilemain`); onClose(); };

    const title = likeCount > 0 ? `${likeCount} Likes` : 'Likes';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth='sm'
            aria-labelledby='likes-modal-title'
        >
            <DialogTitle
                id='likes-modal-title'
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
                {title}
                <IconButton size='small' aria-label='close' onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers onScroll={handleScroll} sx={{ maxHeight: '70vh', p: 0 }}>
                {error && (
                    <Typography color='error' fontSize={14} sx={{ p: 2 }}>{error}</Typography>
                )}

                {!loading && !error && users.length === 0 && (
                    <Typography color='text.secondary' fontSize={14} sx={{ p: 2 }}>
                        No likes yet.
                    </Typography>
                )}

                {users.map((u) => {
                    const following = isFollowByMe(u._id);
                    const pending = followPending.has(u._id);
                    return (
                        <Box
                            key={u._id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                px: 2,
                                py: 1.25,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Avatar
                                src={u.profilePicture}
                                sx={{ width: 44, height: 44, cursor: 'pointer', flexShrink: 0 }}
                                onClick={() => goTo(u._id)}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                    fontWeight={600}
                                    fontSize={14}
                                    noWrap
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => goTo(u._id)}
                                >
                                    {u.name} {u.lastName}
                                </Typography>
                                <Typography fontSize={12} color='text.secondary' noWrap>
                                    {u.job}
                                </Typography>
                                <Typography fontSize={11} color='text.secondary'>
                                    {getFollowersCount(u._id)} followers
                                </Typography>
                            </Box>
                            {u._id !== user?._id && (
                                <Button
                                    size='small'
                                    variant={following ? 'outlined' : 'contained'}
                                    color={following ? 'inherit' : 'primary'}
                                    startIcon={!following && <PersonAddIcon />}
                                    onClick={() => handleFollow(u._id)}
                                    disabled={pending}
                                    aria-label={following ? `Unfollow ${u.name}` : `Follow ${u.name}`}
                                    sx={{ borderRadius: 5, fontSize: 11, flexShrink: 0, minWidth: 88 }}
                                >
                                    {following ? 'Following' : 'Follow'}
                                </Button>
                            )}
                        </Box>
                    );
                })}

                {loading && (
                    Array.from({ length: 5 }).map((_, i) => (
                        <Box
                            key={i}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25 }}
                        >
                            <Skeleton variant='circular' width={44} height={44} />
                            <Box sx={{ flex: 1 }}>
                                <Skeleton width='60%' height={18} />
                                <Skeleton width='40%' height={14} />
                                <Skeleton width='30%' height={12} />
                            </Box>
                            <Skeleton variant='rounded' width={88} height={30} sx={{ borderRadius: 5 }} />
                        </Box>
                    ))
                )}
            </DialogContent>
        </Dialog>
    );
}
