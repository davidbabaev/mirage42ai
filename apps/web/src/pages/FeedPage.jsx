import React, { useCallback, useEffect, useRef, useState } from 'react'
import CardItem from '../components/CardItem'
import FeedCardSkeleton from '../components/FeedCardSkeleton'
import { useCardsProvider } from '../providers/CardsProvider';
import { useAuth } from '../providers/AuthProvider';
import useFollowUser from '../hooks/useFollowUser';
import { useNavigate } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import { Alert, Avatar, Box, Button, Card, Container, Grid, Paper, Typography} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EditIcon from '@mui/icons-material/Edit';
import CreateCardModal from '../components/CreateCardModal';
import CreateCardTrigger from '../components/CreateCardTrigger';
import CardPopupModal from '../components/card/CardPopupModal';
import MobileSuggestions from '../components/MobileSuggestions';
import PeopleModal from '../components/PeopleModal';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import useFavoriteCards from '../hooks/useFavoriteCards';
import { getSuggestedUsers } from '../services/apiService';
import FolderIcon from '@mui/icons-material/Folder';
import isProfileIncomplete from '../utils/isProfileIncomplete';


export default function FeedPage() {

    const {
        feedCards,
        loadMoreFeed,
        feedHasMore,
        feedLoading,
        feedLoadingMore,
        feedError,
    } = useCardsProvider();
    const {user} = useAuth();
    const{getFollowersCount, toggleFollow, isFollowByMe} = useFollowUser();
    const navigate = useNavigate();
    const debounceFollowing = useDebounce(user?.following, 3000);
    const {refreshFeed} = useCardsProvider();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mediaType, setMediaType] = useState(null);
    const [selectedCardId, setSelectedCardId] = useState(null);
    const {favoriteCards ,handleFavoriteCards, handleRemoveCard} = useFavoriteCards();


    // ----------------------------------------------------
    
    const [isFilled, setIsFilled] = useState(false)

    useEffect(() => {
        if(!user) return;
        setIsFilled(isProfileIncomplete(user));
    }, [])

    const [openCommentCardId, setOpenCommentCardId] = useState(null);
    const [suggestModalOpen, setSuggestModalOpen] = useState(false);
    
    // ----------------------------------------------------

    const {registeredCards} = useCardsProvider();

    const myCardsCount = user?.postsCount ?? registeredCards.filter(card => card.userId === user?._id).length;

    // The full accumulated feed (paginated). No client-side cap — infinite scroll
    // appends pages, and capping here would silently stop the feed.
    const countedRegisterCards = feedCards;

    // Infinite-scroll sentinel: a callback ref so the IntersectionObserver is
    // (re)attached every time the sentinel mounts (it unmounts while a page is in
    // flight, then remounts if more remain — this also auto-fills a short viewport).
    const observerRef = useRef(null);
    const sentinelRef = useCallback((node) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }
        if (node) {
            observerRef.current = new IntersectionObserver((entries) => {
                if (entries[0]?.isIntersecting) loadMoreFeed();
            }, { rootMargin: '400px' }); // prefetch just before the bottom
            observerRef.current.observe(node);
        }
    }, [loadMoreFeed]);

    // "People you may know" — friends-of-friends. This was computed client-side by
    // walking the global users array (every user I follow, then everyone THEY
    // follow). GET /users/suggested already does exactly that server-side, ranked by
    // follower count and block-aware, so just ask for it.
    const [uniqueFriendsOfFriends, setSuggestedPeople] = useState([]);

    useEffect(() => {
        let cancelled = false;
        getSuggestedUsers(20)
            .then(res => { if(!cancelled) setSuggestedPeople(res?.users ?? res?.items ?? []); })
            .catch(() => { if(!cancelled) setSuggestedPeople([]); });
        return () => { cancelled = true; };
        // Re-pull when my following set settles (following someone should drop them
        // out of the suggestions).
    }, [debounceFollowing]);

    return(
        <Container maxWidth='lg' sx={{py:{xs: 0, md:3}}}>
            <Grid container spacing={3}>
                {/* Left column — sticky on desktop so it stays in view while the
                    feed scrolls; hidden on mobile, so no mobile change. alignSelf
                    'start' stops the CSS-grid item stretching (which breaks sticky). */}
                <Grid
                    size={{xs:12, md:3}}
                    display={{xs: 'none', md: 'block'}}
                    sx={{
                        position: { md: 'sticky' },
                        top: { md: '24px' },
                        alignSelf: { md: 'start' },
                    }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            borderRadius: 3,
                            border: '0.5px solid',
                            borderColor: 'divider',
                            overflow: 'hidden',
                            textAlign: 'center',
                            bgcolor: 'background.paper',
                            mb:2
                        }}
                    >
                        {/* Cover Image */}
                        <Box
                            sx={{
                                width: '100%',
                                height: 80,
                                backgroundImage: `url(${user?.coverImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}       
                        />

                        <Box 
                            sx={{mt: '-40px', mb:1}} 
                            onClick={() => navigate(`/profiledashboard/${user?._id}/profilemain`)}
                        >
                            <Avatar
                                src={user?.profilePicture}
                                sx={{
                                    width: 80,
                                    height: 80,
                                    border: '2px solid',
                                    borderColor: 'background.paper',
                                    margin: '0 auto',
                                    cursor: 'pointer'
                                }}
                            />
                        </Box>
                        
                        {/* Name, Job, Location */}
                        <Box sx={{px:2, pb:2}}>
                            <Typography 
                                fontWeight={600} 
                                fontSize={16}
                                onClick={() => navigate(`/profiledashboard/${user?._id}/profilemain`)}
                                sx={{cursor: 'pointer'}}
                            >
                                {user?.name} {user?.lastName}
                            </Typography>

                            <Typography 
                                fontSize={13} 
                                color='text.secondaty' 
                                sx={{mb: -0.5}}
                            >
                                {user?.job}
                            </Typography>

                            <Typography fontSize={12} color='text.disabled'>
                                {user?.address.country}, {user?.address.city}
                            </Typography>
                        </Box>

                        {/* Stats row */}
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 3,
                            px: 2,
                            pb: 2,
                            borderTop: '0.5px solid',
                            borderColor: 'divider',
                            pt: 2
                        }}>
                            <Box 
                                textAlign='center'
                                onClick={() => navigate(`/profiledashboard/${user?._id}/followers`)}
                                sx={{cursor: 'pointer'}}
                            >
                                <Typography 
                                    fontWeight={600}
                                    fontSize={14}
                                >
                                    {getFollowersCount(user)}
                                </Typography>

                                <Typography 
                                    fontSize={13}
                                    color='text.secondary'
                                >
                                    followers
                                </Typography>
                            </Box>
                            <Box 
                                textAlign='center'
                                onClick={() => navigate(`/profiledashboard/${user?._id}/following`)}
                                sx={{cursor: 'pointer'}}
                            >
                                <Typography 
                                    fontWeight={600}
                                    fontSize={14}
                                >
                                    {new Set(user?.following || []).size}
                                </Typography>

                                <Typography 
                                    fontSize={13}
                                    color='text.secondary'
                                >
                                    following
                                </Typography>
                            </Box>

                            <Box 
                                textAlign='center'
                                onClick={() => navigate(`/profiledashboard/${user?._id}/profilemain`)}
                                sx={{cursor: 'pointer'}}
                            >
                                <Typography 
                                    fontWeight={600}
                                    fontSize={14}
                                >
                                    {myCardsCount}
                                </Typography>

                                <Typography 
                                    fontSize={13}
                                    color='text.secondary'
                                >
                                    posts
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>

                    {/* Buttons */}
                    <Paper
                        elevation={0}
                        sx={{
                            borderRadius: 3,
                            border: '0.5px solid',
                            borderColor: 'divider',
                            overflow: 'hidden',
                            textAlign: 'center',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Box sx={{
                            px: 2,
                            pb: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            pt: 2
                        }}

                        >
                            <Button
                                fullWidth
                                size='small'
                                startIcon={<FavoriteIcon/>}
                                onClick={() => navigate('/dashboard/myfavorites')}
                                color='inherit'
                                sx={{fontSize: 13, textTransform: 'none'}}
                            >
                                Favorite Users
                            </Button>

                            <Button
                                fullWidth
                                size='small'
                                startIcon={<BookmarkIcon/>}
                                onClick={() => navigate('/dashboard/myfavoritescards')}
                                color='inherit'
                                sx={{fontSize: 13, textTransform: 'none'}}
                            >
                                Favorite Posts
                            </Button>

                            <Button
                                fullWidth
                                size='small'
                                startIcon={<EditIcon/>}
                                onClick={() => navigate('/dashboard/myprofile')}
                                color='inherit'
                                sx={{fontSize: 13, textTransform: 'none'}}
                            >
                                Edit Profile
                            </Button>

                        </Box>
                    </Paper>

                </Grid>

                {/* Center column */}
                <Grid size={{xs:12, md:6}}>
                    {isFilled === true && (
                        <Alert
                            severity='warning'
                            variant='outlined'
                            action={
                                <Button
                                    size='small'
                                    color='inherit'
                                    startIcon={<EditIcon/>}
                                    onClick={() => 
                            navigate(`/dashboard/myprofile`, { state: {editMode: true} })}
                                    sx={{
                                        bgcolor: '#f188322b', 
                                        fontSize: {xs:10, md: 10}, 
                                        p:1, 
                                        borderRadius: 2,
                                    }}
                                >
                                    Edit Profile
                                </Button>
                            }
                            sx={{
                                mt: {xs: 2, md: 0},
                                mb: 2,
                                bgcolor: 'background.paper',
                                borderRadius: 3,
                                fontSize: {xs: 12, md: 13},
                                lineHeight: {xs: 1.2, md: 1.2},
                                '& .MuiAlert-action': {
                                    alignItems: 'center',
                                    padding: 0
                                }
                            }}
                        >
                            Complete your profile to get the best experience
                        </Alert>
                    )}

                    <Box display={{xs: 'none', md: 'block'}}>
                        <CreateCardTrigger
                            onOpen={(type) => {
                                setIsModalOpen(true);
                                setMediaType(type);
                            }}
                        />
                    </Box>

                    {isModalOpen && (
                        <CreateCardModal
                            onCardPosted={() => refreshFeed()}
                            onClose={() => setIsModalOpen(false)}
                            mediaButton={mediaType}
                        />
                    )}

                    {/* Card Item */}
                    {countedRegisterCards.map((card, index) => {
                        // Show "Suggested for you" header before the first isSuggested card.
                        // This labels the cold-start feed so new users never see an unlabelled feed.
                        const isFirstSuggested =
                            card.isSuggested &&
                            (index === 0 || !countedRegisterCards[index - 1]?.isSuggested);

                        return (
                            <React.Fragment key={card._id}>
                                {isFirstSuggested && (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            mt: index === 0 ? 0 : 1,
                                            mb: 1,
                                            px: 0.5,
                                        }}
                                    >
                                        <Typography
                                            variant="subtitle2"
                                            fontWeight={700}
                                            color="text.secondary"
                                            sx={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}
                                        >
                                            Suggested for you
                                        </Typography>
                                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                                    </Box>
                                )}
                                <CardItem
                                    card={card}
                                    onOpenCard={() => setSelectedCardId(card._id)}
                                    openCommentCardId={openCommentCardId}
                                    setOpenCommentCardId = {setOpenCommentCardId}
                                    onRemoveSavedCard = {() => handleRemoveCard(card)}
                                    onSaveCard = {() => handleFavoriteCards(card)}
                                    isSavedCard = {favoriteCards.some(c => c._id === card._id)}
                                />

                                {/* Mobile-only: inject a "People you may know" strip between
                                    posts. Desktop already shows the right-column sidebar. */}
                                {index === 2 && uniqueFriendsOfFriends.length > 0 && (
                                    <Box display={{xs: 'block', md: 'none'}}>
                                        <MobileSuggestions suggestions={uniqueFriendsOfFriends} />
                                    </Box>
                                )}
                            </React.Fragment>
                        );
                    })}

                    {/* Initial load — skeletons shaped like feed cards */}
                    {feedLoading && countedRegisterCards.length === 0 && (
                        <Box aria-busy="true" aria-label="Loading feed">
                            <FeedCardSkeleton />
                            <FeedCardSkeleton />
                            <FeedCardSkeleton />
                        </Box>
                    )}

                    {/* Empty feed — nothing to show at all (distinct from end-of-feed) */}
                    {!feedLoading && !feedError && countedRegisterCards.length === 0 && (
                        <Paper
                            elevation={0}
                            sx={{
                                borderRadius: 3,
                                border: '0.5px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                textAlign: 'center',
                                py: 6,
                                px: 3,
                            }}
                        >
                            <Typography fontWeight={700} gutterBottom>Your feed is empty</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Follow people or explore posts to fill your feed.
                            </Typography>
                        </Paper>
                    )}

                    {/* Error loading a page — inline retry, never a silent stall */}
                    {feedError && (
                        <Paper
                            elevation={0}
                            sx={{
                                borderRadius: 3,
                                border: '0.5px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                textAlign: 'center',
                                py: 4,
                                px: 3,
                                mt: 2,
                            }}
                        >
                            <Typography color="error" gutterBottom>
                                Couldn't load the feed.
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={() => (countedRegisterCards.length ? loadMoreFeed() : refreshFeed())}
                            >
                                Retry
                            </Button>
                        </Paper>
                    )}

                    {/* Loading the next page */}
                    {feedLoadingMore && <FeedCardSkeleton />}

                    {/* Sentinel: scrolling it into view auto-loads the next page.
                        Hidden while a page loads or after an error (no auto-retry loop). */}
                    {feedHasMore && !feedLoadingMore && !feedError && (
                        <Box ref={sentinelRef} sx={{ height: 1 }} />
                    )}

                    {/* End of feed */}
                    {!feedHasMore && !feedLoading && !feedError && countedRegisterCards.length > 0 && (
                        <Box sx={{ textAlign: 'center', py: 3 }}>
                            <Typography variant="body2" fontWeight={600} color="text.secondary">
                                You're all caught up
                            </Typography>
                        </Box>
                    )}

                    {selectedCardId && (
                        <CardPopupModal
                            cardId = {selectedCardId}
                            onClose = {() => setSelectedCardId(null)}
                        />
                    )}

                </Grid>


                {/* Right column — desktop only; mobile uses the inline
                    MobileSuggestions carousel injected in the feed instead. */}
                <Grid size={{xs:12, md:3}} display={{xs: 'none', md: 'block'}}>
                    <Paper
                        elevation={0}
                        sx={{
                            borderRadius: 3,
                            border: '0.5px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <Box
                            sx={{
                                px:2,
                                py:1.5,
                                borderBottom: '0.5px solid',
                                borderColor: 'divider'
                            }}
                        >
                            <Typography
                                fontWeight={600}
                                fontSize={14}
                            >
                                people You May Know
                            </Typography>
                        </Box>

                        {/* List */}
                        <Box>
                            {uniqueFriendsOfFriends.length === 0 && (
                                <Typography fontSize={13} color='text.secondary' p={2}>
                                    No suggestions yet
                                </Typography>
                            )}
                        </Box>

                        {/* Users Suggestions List (first few; "See all" opens the modal) */}
                        {uniqueFriendsOfFriends.slice(0, 5).map((userF) => (
                            <Box
                                key={userF._id}
                                sx={{
                                    display:'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: 1,
                                    // mb: 2,
                                    // px:2
                                    my: 2
                                }}
                            >
                                {/* avatar + info */}
                                <Box sx={{display: 'flex', gap: 1.5, px: 2}}>
                                    <Avatar
                                        src={userF?.profilePicture}
                                        sx={{cursor: 'pointer', width: 48, height: 48}}
                                        onClick={() => navigate(`/profiledashboard/${userF?._id}/profilemain`)}
                                    />
                
                                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
                                        <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                                            {userF?.name} {userF?.lastName}
                                            <Typography 
                                                component='span' 
                                                color='text.secondary'
                                                fontSize={11}
                                                fontWeight={400}
                                            >
                                                {isFollowByMe(userF?._id) && ' · following'}
                                            </Typography>
                                        </Typography>
                
                                        <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                            {userF?.job}
                                        </Typography>
                
                                        <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                            {getFollowersCount(userF)} followers
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box>
                                    {user && user._id !== userF?._id && !isFollowByMe(userF?._id) &&(
                                        <Button
                                            size='small'
                                            variant={'outlined'}
                                            startIcon={<PersonAddIcon/>}
                                            onClick={async () => {
                                                await toggleFollow(userF?._id)
                                            }}
                                            sx={{
                                                fontSize: 9, 
                                                minWidth: 70, 
                                                borderRadius: 5, 
                                                py: 0.3,
                                                mx: 2,
                                                '& .MuiButton-startIcon' : {mb: 0.2}, lineHeight: 0 
                                            }}
                                        >
                                            Follow
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        ))}


{/*                                 <Avatar
                                    src={userF.profilePicture}
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => navigate(`/profiledashboard/${userF._id}/profilemain`)}
                                />

                                <Typography
                                    fontSize={13}
                                    fontWeight={500}
                                    sx={{
                                        flex: 1,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {userF.name} {userF.lastName}
                                </Typography>

                                <Button
                                    size='small'
                                    variant={isFollowByMe(userF._id) ? 'outlined' : 'contained'}
                                    onClick={async () => {
                                        await toggleFollow(userF._id)
                                        await refreshFeed()
                                    }}
                                    sx={{fontSize: 11, minWidth: 70}}
                                >
                                    {isFollowByMe(userF._id) ? 'Unfollow' : 'Follow'}
                                </Button> */}

                        {uniqueFriendsOfFriends.length > 0 && (
                            <Box sx={{px: 2, pb: 2, pt: 1, borderTop: '0.5px solid', borderColor: 'divider'}}>
                                <Button
                                    fullWidth
                                    size='small'
                                    onClick={() => setSuggestModalOpen(true)}
                                    sx={{textTransform: 'none'}}
                                >
                                    See all
                                </Button>
                            </Box>
                        )}

                    </Paper>
                </Grid>
            </Grid>

            <PeopleModal
                open={suggestModalOpen}
                onClose={() => setSuggestModalOpen(false)}
                title='People you may know'
                users={uniqueFriendsOfFriends}
                mode='suggested'
            />

        </Container>
    )
}
