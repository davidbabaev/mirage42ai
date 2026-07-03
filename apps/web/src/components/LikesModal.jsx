import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Avatar, Box, Button, Dialog, DialogContent, DialogTitle,
    IconButton, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import InfiniteScroll from './InfiniteScroll';
import { useCursorPagination } from '../hooks/useCursorPagination';
import useFollowUser from '../hooks/useFollowUser';
import { useAuth } from '../providers/AuthProvider';
import { getCardLikes } from '../services/apiService';

// Modal that lists users who liked a card. Fetches from GET /cards/:id/likes
// with server-side cursor pagination so it scales to arbitrarily large like
// counts without loading everything at once.
export default function LikesModal({ open, onClose, cardId, likeCount }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toggleFollow, isFollowByMe, getFollowersCount } = useFollowUser();
    const [followPending, setFollowPending] = useState(new Set());

    // Callback ref captures the DialogContent scroll container so InfiniteScroll
    // can root its IntersectionObserver there instead of the window.
    const [scrollEl, setScrollEl] = useState(null);

    const fetcher = useCallback(
        (cursor) =>
            getCardLikes(cardId, cursor, 15).then((r) => ({
                items: r.users ?? [],
                nextCursor: r.nextCursor ?? null,
            })),
        [cardId],
    );

    const { items: users, hasMore, loading, loadingMore, error, refresh, loadMore } =
        useCursorPagination(fetcher);

    // Reset and load the first page whenever the modal opens.
    useEffect(() => {
        if (open && cardId) refresh();
    }, [open, cardId, refresh]);

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

            <DialogContent dividers ref={setScrollEl} sx={{ maxHeight: '70vh', p: 0 }}>
                <InfiniteScroll
                    loading={loading}
                    loadingMore={loadingMore}
                    hasMore={hasMore}
                    error={!!error}
                    isEmpty={!loading && users.length === 0}
                    onLoadMore={loadMore}
                    onRetry={refresh}
                    root={scrollEl}
                    showEnd={false}
                    emptyState={
                        <Typography color='text.secondary' fontSize={14} sx={{ p: 2 }}>
                            No likes yet.
                        </Typography>
                    }
                >
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
                </InfiniteScroll>
            </DialogContent>
        </Dialog>
    );
}
