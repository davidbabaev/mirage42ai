import React, { useCallback, useEffect, useState } from 'react'
import { useCardsProvider } from '../../providers/CardsProvider';
import { useAuth } from '../../providers/AuthProvider';
import getTimeAgo from '../../utils/getTimeAgo';
import MediaDisplay from '../../components/MediaDisplay';
import { Box, Button, Chip, Typography, useTheme } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateCardModal from '../../components/CreateCardModal';
import { getExploreCards } from '../../services/apiService';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import InfiniteScroll from '../../components/InfiniteScroll';
import { useCursorPagination } from '../../hooks/useCursorPagination';



export default function MyCardsSection() {

    const {handleDeleteCard, refreshFeed} = useCardsProvider();
    const {user} = useAuth();

    const [isExpanded, setIsExpanded] = useState(null)
    const [editingCardId, setEditingCardId] = useState(null);
    const theme = useTheme();
    const [confirmDeleteCard, setConfirmDeleteCard] = useState(null);

    // My posts, paginated off the server rather than filtered out of the global
    // all-cards array (which is being retired).
    const myCardsFetcher = useCallback(
        (cursor) => getExploreCards(cursor, 5, user?._id).then(r => ({
            items: r.items ?? [],
            nextCursor: r.nextCursor ?? null,
        })),
        [user?._id]
    );
    const {
        items: myCards,
        hasMore,
        loading,
        loadingMore,
        error,
        refresh: refreshMyCards,
        loadMore,
    } = useCursorPagination(myCardsFetcher);

    useEffect(() => {
        if (user?._id) refreshMyCards();
    }, [user?._id, refreshMyCards]);

    if(!user){
        return <OnLoadingSkeletonBox/>
    }

return (
<Box>
    {editingCardId && (
        <CreateCardModal
            card={myCards.find(c => c._id === editingCardId)}
            onClose={() => {
                setEditingCardId(null);
                // The list is server-paginated now, so pull the edited card back.
                refreshMyCards();
            }}
            onCardPosted={() => {}}
        />
    )}

    <InfiniteScroll
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={!!error}
        isEmpty={!loading && myCards.length === 0}
        onLoadMore={loadMore}
        onRetry={refreshMyCards}
        root={null}
        emptyState={
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                    You haven't created any cards yet.
                </Typography>
            </Box>
        }
    >
    {myCards.map((card) => (
        <Box key={card._id}>
            <Box 
                sx={{
                    width: '100%', 
                    display: 'flex',
                    flexDirection: {xs: 'column', md: 'row'},
                    borderRadius: 3,
                    border: '0.5px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    my: 2,
                    p: 2,
                    gap: 2
                }}
            >
                <Box sx={{maxWidth: {xs: '100%', md: 250}}}>
                    <MediaDisplay
                        mediaUrl={card.mediaUrl}
                        mediaType={card.mediaType}
                        style={{
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            borderRadius: 10
                        }}
                    />
                </Box>

                <Box flex={1}>
                    {/* Title */}
                    {card.title && (
                        <Typography lineHeight={0.8} component='div' fontWeight={600} fontSize={18} mb={1}>
                            {card.title}
                        </Typography>
                    )}

                    <Box sx={{display: 'flex', gap: 1, alignItems: 'center', mb:1}}>
                        {card.category && (
                            <Chip 
                                label={card.category} 
                                size='small'  
                            />
                        )}
                        <Typography component={'div'} fontSize={12} color='text.secondary' lineHeight={0.9}>
                            {getTimeAgo(card.createdAt)}
                        </Typography>

                    </Box>

                    {/* Contnet */}
                    {card.content && (
                        <Typography component='div' fontWeight={400} fontSize={14} mb={1} sx={{whiteSpace: 'pre-wrap'}}>
    
                            {isExpanded === card._id ? card.content : card.content.slice(0, 150)}
    
                            {card.content.length > 150 && (
                                <span
                                    onClick={() => setIsExpanded(isExpanded === card._id ? null : card._id)}
                                    style={{
                                        color: theme.palette.primary.main, 
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        marginLeft: 4
    
                                    }}
                                >
                                    {isExpanded === card._id ? '...show less' : '...read more'}
                                </span>
                            )}
    
                        </Typography>
                    )}

                </Box>

                <Box sx={{display: 'flex', gap: 1, alignItems: 'start'}}>
                    <Button 
                        variant='outlined'
                        size='small'
                        sx={{borderRadius: 5, px: 2, py:0.5, fontSize: 10}}
                        endIcon={<EditIcon/>}
                        onClick={() => setEditingCardId(card._id)}
                        
                    >
                        Edit post
                    </Button>

                    <Button 
                        variant='outlined'
                        color='error'
                        size='small'
                        sx={{borderRadius: 5, px: 2, py:0.5, fontSize: 10}}
                        endIcon={<DeleteIcon/>}
                        onClick={() => setConfirmDeleteCard(card)}
                    >
                        Delete Post
                    </Button>
                </Box>
                
            </Box>
        </Box>
    ))}
    </InfiniteScroll>

        {confirmDeleteCard && (
            <ConfirmationDialog
                message={`Delete Card "${
                    (confirmDeleteCard.title).slice(0, 20)
                    ||
                    (confirmDeleteCard.content).slice(0, 10)
                    }..."?`}
                onClose={() => setConfirmDeleteCard(null)}
                onConfirm={async () => {
                    await handleDeleteCard(confirmDeleteCard._id);
                    // Reload MY list (server-paginated) and the feed. The old
                    // getAllCards()/fetchCards() pair reloaded every card in the
                    // app — one of the two loads this epic is removing.
                    await refreshMyCards();
                    await refreshFeed();
                }}
            />
        )}
</Box>
)
}
