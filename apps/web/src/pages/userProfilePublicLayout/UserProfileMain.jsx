import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider';
import CardItem from '../../components/CardItem';
import InfiniteScroll from '../../components/InfiniteScroll';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { getExploreCards } from '../../services/apiService';
import CardPopupModal from '../../components/card/CardPopupModal';
import CreateCardTrigger from '../../components/CreateCardTrigger';
import CreateCardModal from '../../components/CreateCardModal';
import PeopleModal from '../../components/PeopleModal';
import { Avatar, Box, Button, Divider, Grid, Paper, Typography } from '@mui/material';
import useFollowUser from '../../hooks/useFollowUser';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LoginPopup from '../../components/LoginPopup';
import useFavoriteCards from '../../hooks/useFavoriteCards';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';


export default function UserProfileMain() {

    const {id} = useParams();
    const {users} = useUsersProvider();
    const {user, isLoggedIn} = useAuth();
    const navigate = useNavigate();
    const {favoriteCards ,handleFavoriteCards, handleRemoveCard} = useFavoriteCards();

    // This user's posts, paginated off the server, instead of filtering the global
    // all-cards array (which cannot scale and is being retired). Same primitives as
    // the sibling media grid: useCursorPagination + <InfiniteScroll>.
    const postsFetcher = useCallback(
        (cursor) => getExploreCards(cursor, 10, id).then(r => ({
            items: r.items ?? [],
            nextCursor: r.nextCursor ?? null,
        })),
        [id]
    );
    const {
        items: userCards,
        hasMore: postsHasMore,
        loading: postsLoading,
        loadingMore: postsLoadingMore,
        error: postsError,
        refresh: refreshPosts,
        loadMore: loadMorePosts,
    } = useCursorPagination(postsFetcher);

    useEffect(() => {
        if (id) refreshPosts();
    }, [id, refreshPosts]);

    
    const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
    function onCloseLoginPopup(){
        setIsLoginPopupOpen(false)
    }

    
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [openCommentCardId, setOpenCommentCardId] = useState(null);

    // Post-composer (own profile only): mirrors the feed's CreateCardTrigger ->
    // CreateCardModal flow. The post list is server-paginated, so closing the
    // composer refreshes page 1 to surface the new post.
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [mutualModalOpen, setMutualModalOpen] = useState(false);
    const [suggestModalOpen, setSuggestModalOpen] = useState(false);
    const [createMediaType, setCreateMediaType] = useState(undefined);

    const {toggleFollow, isFollowByMe, getFollowersCount} = useFollowUser();
    
    const userProfile = users.find(u => u._id === id);
    
    if(!userProfile){
        return <OnLoadingSkeletonBox/>
    }

    const mutualPeople = users.filter((u) => 
        user?.following?.includes(u._id) &&
        userProfile?.following?.includes(u._id)
    )

    // people that this user follow on,
    // and me not following
    const suggestionsPeople = users.filter((u) => 
        userProfile?.following?.includes(u._id) &&
        !user?.following?.includes(u._id) &&
        u._id !== user?._id
    )
    
    const userData = [
        {label: 'Job', value: userProfile?.job},
        {label: 'Location', value: userProfile?.address.country + ', ' + userProfile?.address.city},
        {label: 'Gender', value: userProfile?.gender},
        {label: 'Joined', value: userProfile.createdAt.split("T")[0]},
    ] 
    
    // Only the owner can post from their own profile.
    const isOwnProfile = user?._id === userProfile?._id;

return (
    <Grid container spacing={2}>
        <Grid size={{xs: 12, md:7}}>
            {isOwnProfile && (
                <Box sx={{mt: 2, mb: 2}}>
                    <CreateCardTrigger
                        onOpen={(type) => {
                            setCreateMediaType(type);
                            setIsCreateOpen(true);
                        }}
                    />
                </Box>
            )}

            {isOwnProfile && isCreateOpen && (
                <CreateCardModal
                    mediaButton={createMediaType}
                    onClose={() => {
                        setIsCreateOpen(false);
                        // The list is now server-paginated, so a new post no longer
                        // appears just by landing in the global cards array — pull
                        // page 1 again so it shows up at the top.
                        refreshPosts();
                    }}
                />
            )}

            <InfiniteScroll
                loading={postsLoading}
                loadingMore={postsLoadingMore}
                hasMore={postsHasMore}
                error={!!postsError}
                isEmpty={!postsLoading && userCards.length === 0}
                onLoadMore={loadMorePosts}
                onRetry={refreshPosts}
                root={null}
                emptyState={
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                            {isOwnProfile ? "You haven't posted yet" : 'No posts yet'}
                        </Typography>
                    </Box>
                }
            >
                {userCards.map((card) => (
                    <CardItem
                        key={card._id}
                        card={card}
                        onOpenCard={() => setSelectedCardId(card._id)}
                        openCommentCardId={openCommentCardId}
                        setOpenCommentCardId = {setOpenCommentCardId}
                        onRemoveSavedCard = {() => handleRemoveCard(card)}
                        onSaveCard = {() => handleFavoriteCards(card)}
                        isSavedCard = {favoriteCards.some(c => c._id === card._id)}
                    />
                ))}
            </InfiniteScroll>

            {selectedCardId && (
                <CardPopupModal
                    cardId = {selectedCardId}
                    onClose = {() => setSelectedCardId(null)}
                />
            )}
        
        </Grid>

        <Grid 
            size={{xs:12, md:5}}
            display={{xs: 'none',md:'block'}}
            sx={{
                position: 'sticky',
                top: 64,
                overflow: 'auto',
                maxHeight: 'calc(100vh - 64px)'
            }}
        >

            <Paper
                elevation={0}
                sx={{
                    border: '1px solid',
                    borderRadius: 3,
                    borderColor: 'divider',
                    p: 2,
                    mt: 2
                }}
            >
                <Typography sx={{fontSize: 18, fontWeight: 700}}>
                    About
                </Typography>
                <Typography fontSize={15} sx={{lineHeight: 1.2, whiteSpace: 'pre-wrap'}}>
                    {userProfile?.aboutMe}
                </Typography>
                <Divider sx={{py: 1}}/>


                {userData.map((u) => (
                    <Box mt={2} key={u.label}>
                        <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
                            <Typography fontSize={15} color='text.secondary'>{u.label}</Typography>
                            <Typography fontSize={15} fontWeight={700}>{u.value}</Typography>
                        </Box>
                    </Box>
                ))}
            </Paper>

            <Paper
                elevation={0}
                sx={{
                    border: '1px solid',
                    borderRadius: 3,
                    borderColor: 'divider',
                    p: 2,
                    mt: 2
                }}
            >
                <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
                    <Typography fontWeight={600} fontSize={18}>
                        Media
                    </Typography>

                    <Typography 
                        fontSize={14} color='primary.main' sx={{cursor: 'pointer'}}
                        onClick = {() => navigate(`/profiledashboard/${userProfile?._id}/media`)}
                    >
                        See all
                    </Typography>
                </Box>

                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 0.5,
                    borderRadius: 2,
                    overflow: 'hidden'
                }}>
                    {userCards.slice(0,9).map((image) => (
                        <Box
                            key={image._id}
                            sx={{
                                aspectRatio: '1',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                '&:hover': {opacity: 0.85},
                                ...(image.mediaType !== 'video' && {
                                    backgroundImage: `url(${image.mediaUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }),
                            }}
                            onClick={() => isLoggedIn ? setSelectedCardId(image._id) : setIsLoginPopupOpen(true)}
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
                </Box>
            </Paper>
                
            {user?._id !== userProfile?._id && (
                <Paper
                    elevation={0}
                    sx={{
                        border: '1px solid',
                        borderRadius: 3,
                        borderColor: 'divider',
                        p: 2,
                        mt: 2,
                        display: mutualPeople.length < 1 ? 'none' : 'block'
                    }}
                >
                    <Box 
                        sx={{
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            mb: 1,
                        }}>
                        <Typography fontWeight={600} fontSize={18}>
                            Mutual friends
                        </Typography>

                        {mutualPeople.length > 0 && (
                            <Typography
                                fontSize={14} color='primary.main' sx={{cursor: 'pointer'}}
                                onClick={() => setMutualModalOpen(true)}
                            >
                                See all
                            </Typography>
                        )}
                    </Box>

                    <Box>
                        {mutualPeople.map((person) => (
                            <Box key={person._id} sx={{display: 'flex', gap: 1.5, py: 1}}>
                                <Avatar
                                    src={person?.profilePicture}
                                    sx={{cursor: 'pointer', width: 48, height: 48}}
                                    onClick={() => navigate(`/profiledashboard/${person?._id}/profilemain`)}
                                />

                                <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
                                    <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                                        {person?.name} {person?.lastName}
                                        <Typography 
                                            component='span' 
                                            color='text.secondary'
                                            fontSize={11}
                                            fontWeight={400}
                                        >
                                            {isFollowByMe(person?._id) && ' · following'}
                                        </Typography>
                                    </Typography>

                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {person?.job}
                                    </Typography>

                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {getFollowersCount(person)} followers
                                    </Typography>

                            </Box>
                        </Box>
                        ))}
                    </Box>
                </Paper>
            )}

            {isLoggedIn && (
                <Paper
                    elevation={0}
                    sx={{
                        border: '1px solid',
                        borderRadius: 3,
                        borderColor: 'divider',
                        p: 2,
                        mt: 2,
                        display: suggestionsPeople.length < 1 ? 'none' : 'block'
                    }} 
                >
                    <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
                        <Typography fontWeight={600} fontSize={18}>
                            Make New Friends
                        </Typography>
                        {suggestionsPeople.length > 0 && (
                            <Typography
                                fontSize={14} color='primary.main' sx={{cursor: 'pointer'}}
                                onClick={() => setSuggestModalOpen(true)}
                            >
                                See all
                            </Typography>
                        )}
                    </Box>

                    <Box>
                        {suggestionsPeople.map((person) => (
                            <Box key={person._id} sx={{display: 'flex', gap: 1.5, alignItems: 'center'}}>
                                <Avatar
                                    src={person?.profilePicture}
                                    sx={{cursor: 'pointer', width: 48, height: 48}}
                                    onClick={() => navigate(`/profiledashboard/${person?._id}/profilemain`)}
                                />

                                <Box sx={{
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: 0.5,
                                    flex: 1,
                                    my: 1,
                                }}>
                                    <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                                        {person?.name} {person?.lastName}
                                        <Typography 
                                            component='span' 
                                            color='text.secondary'
                                            fontSize={11}
                                            fontWeight={400}
                                        >
                                            {isFollowByMe(person?._id) && ' · following'}
                                        </Typography>
                                    </Typography>

                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {person?.job}
                                    </Typography>

                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {getFollowersCount(person)} followers
                                    </Typography>

                                </Box>

                                {/* Right: Follow button */}
                                {user && user._id !== person?._id && !isFollowByMe(person?._id) &&(
                                    <Button
                                        size='small'
                                        variant={'outlined'}
                                        startIcon={<PersonAddIcon/>}
                                        onClick={async () => {
                                            await toggleFollow(person?._id)
                                        }}
                                        sx={{
                                            fontSize: 9, 
                                            borderRadius: 5, 
                                            // '& .MuiButton-startIcon' : {mb: 0.2} 
                                        }}
                                    >
                                        Follow
                                    </Button>
                                )}
                            
                        </Box>
                        ))}

                    </Box>
                </Paper>
            )}

        </Grid>


        {isLoginPopupOpen && (
            <LoginPopup
                onCloseLoginPopup={onCloseLoginPopup}
            />
        )}

        <PeopleModal
            open={mutualModalOpen}
            onClose={() => setMutualModalOpen(false)}
            title='Mutual friends'
            users={mutualPeople}
            mode='mutual'
        />
        <PeopleModal
            open={suggestModalOpen}
            onClose={() => setSuggestModalOpen(false)}
            title='Make New Friends'
            users={suggestionsPeople}
            mode='suggested'
        />
    </Grid>
)
}
