import { Box, Paper, Typography } from '@mui/material'
import React, { useState, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom';
import CardPopupModal from '../../components/card/CardPopupModal';
import { useAuth } from '../../providers/AuthProvider';
import LoginPopup from '../../components/LoginPopup';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import InfiniteScroll from '../../components/InfiniteScroll';
import { getExploreCards } from '../../services/apiService';

export default function UserProfileMedia() {

    const {users} = useUsersProvider();
    const {id} = useParams();
    const [selectedCardId, setSelectedCardId] = useState(null);
    const {isLoggedIn} = useAuth();

    const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
    function onCloseLoginPopup(){
        setIsLoginPopupOpen(false)
    }

    const userProfile = users.find(u => u._id === id);
    const profileId = userProfile?._id;

    const fetcher = useCallback(
        (cursor) => getExploreCards(cursor, 12, profileId).then(r => ({
            items: r.items ?? [],
            nextCursor: r.nextCursor ?? null,
        })),
        [profileId]
    );

    const { items, hasMore, loading, loadingMore, error, refresh, loadMore } = useCursorPagination(fetcher);

    useEffect(() => {
        if (profileId) refresh();
    }, [profileId, refresh]);

    if(!userProfile){
        return <OnLoadingSkeletonBox/>
    }

  return (
    <Box>
        <InfiniteScroll
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            error={!!error}
            isEmpty={!loading && items.length === 0}
            onLoadMore={loadMore}
            onRetry={refresh}
            root={null}
            emptyState={
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">No posts yet</Typography>
                </Box>
            }
        >
            <Paper
                elevation={0}
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {xs: 'repeat(3,1fr)',md:'repeat(5,1fr)'},
                    gap: 1,
                    borderRadius: 3,
                    p:2,
                    my: 2,
                }}
            >
                {items.map((image) => (
                    <Box
                        key={image._id}
                        sx={{
                            aspectRatio: '1',
                            borderRadius: 2,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            '&:hover': {opacity: 0.85},
                            ...(image.mediaType !== 'video' && {
                                backgroundImage: `url(${image.mediaUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                            }),
                        }}
                        onClick = {() => isLoggedIn ? setSelectedCardId(image._id): setIsLoginPopupOpen(true)}
                    >
                        {image.mediaType === 'video' && (
                            <video
                                src={`${image.mediaUrl}#t=0.1`}
                                muted
                                playsInline
                                preload="metadata"
                                style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none'}}
                            />
                        )}
                    </Box>
                ))}
                {selectedCardId && (
                    <CardPopupModal
                        cardId = {selectedCardId}
                        onClose = {() => setSelectedCardId(null)}
                    />
                )}
            </Paper>
        </InfiniteScroll>

        {isLoginPopupOpen && (
            <LoginPopup
                onCloseLoginPopup={onCloseLoginPopup}
            />
        )}
    </Box>
  )
}
