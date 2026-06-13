import React, { useEffect, useState } from 'react'
import CardItem from '../components/CardItem'
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
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import useFavoriteCards from '../hooks/useFavoriteCards';
import { useUsersProvider } from '../providers/UsersProvider';
import FolderIcon from '@mui/icons-material/Folder';
import isProfileIncomplete from '../utils/isProfileIncomplete';


export default function FeedPage() {

    const {feedCards} = useCardsProvider();
    const [count] = useState(50);
    const {user} = useAuth();
    const {users} = useUsersProvider();
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
    
    // ----------------------------------------------------

    const userFollowing = users.filter(userU => debounceFollowing?.includes(userU._id))

    const {registeredCards} = useCardsProvider();

    const myCardsCount = registeredCards.filter(card => card.userId === user?._id).length;

    const countedRegisterCards = feedCards.slice(0, count)

    const friendsOfFriends = userFollowing.map((user) => {
        const somt = user.following;
        
    const usersdata = users.filter(userU => somt.includes(userU._id))
        return usersdata
    }).flat().filter(userU => userU._id !== user._id).filter(userU => !debounceFollowing?.includes(userU._id));
    
    const uniqueFriendsOfFriends = 
    [...new Map(friendsOfFriends.map((u => {return [u._id, u]}))).values()]

    return(
        <Container maxWidth='lg' sx={{py:{xs: 0, md:3}}}>
            <Grid container spacing={3}>
                {/* Left column */}
                <Grid size={{xs:12, md:3}} display={{xs: 'none', md: 'block'}}>
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
                                    {getFollowersCount(user?._id)}
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
                                    {(user?.following || []).length}
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
                                mt: 2,
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
                    {countedRegisterCards.map((card) => (
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

                    {selectedCardId && (
                        <CardPopupModal
                            cardId = {selectedCardId}
                            onClose = {() => setSelectedCardId(null)}
                        />
                    )}

                </Grid>


                {/* Right column */}
                <Grid size={{xs:12, md:3}}>
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

                        {/* Users Suggestions List */}
                        {uniqueFriendsOfFriends.map((userF) => (
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
                                            {getFollowersCount(userF?._id)} followers
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
                                                await refreshFeed();
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

                    </Paper>
                </Grid>
            </Grid>

        </Container>
    )
}
