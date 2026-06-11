import React, { useRef, useState } from 'react'
import useFavoriteCards from '../hooks/useFavoriteCards';
import { useAuth } from '../providers/AuthProvider';
import useLikedCards from '../hooks/useLikedCards';
import { useNavigate } from 'react-router-dom';
import useCommentsCards from '../hooks/useCommentsCards';
import CardsComments from './CardsComments';
import LoginPopup from './LoginPopup';
import getTimeAgo from '../utils/getTimeAgo';
import MediaDisplay from './MediaDisplay';
import { Avatar, Box, Button, Chip, Divider, Typography, useTheme } from '@mui/material';
import useFollowUser from '../hooks/useFollowUser';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useCardsProvider } from '../providers/CardsProvider';
import LaunchIcon from '@mui/icons-material/Launch';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useUsersProvider } from '../providers/UsersProvider';

export default function CardItem({
    card, 
    onOpenCard,
    openCommentCardId, 
    setOpenCommentCardId,
    onSaveCard, 
    isSavedCard, 
    onRemoveSavedCard,
}) {

    const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
    function onCloseLoginPopup(){
        setIsLoginPopupOpen(false)
    }
    
    const {addComment, countComments, removeComment} = useCommentsCards();
    const {toggleFollow, isFollowByMe, getFollowingCount, getFollowersCount} = useFollowUser();
    const {refreshFeed} = useCardsProvider();
    const [isExpanded, setIsExpanded] = useState(false)
    const theme = useTheme();
    const inputRef = useRef(null);    

    const navigate = useNavigate();
    const {toggleLike, isLikeByMe, getLikeCount} = useLikedCards()
    const {user, isLoggedIn} = useAuth();
    const {users} = useUsersProvider(); 
    // const {favoriteCards ,handleFavoriteCards} = useFavoriteCards();

    const creator = users.find(u => u._id === card.userId);

    const getLikesUsers = users.filter((u) => card.likes.includes(u._id)).slice(0,4)


  return (
        <Box sx={{
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            borderRadius: 3,
            border: '0.5px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            my: 2
          }}>
        <Box>

            {/* Creator flow */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                // borderBottom: '1px solid',
                // borderColor: 'divider',
            }}>

                {/* left avatar + info */}
                <Box sx={{display: 'flex', gap: 1.5, p: 2}}>
                    <Avatar
                        src={creator?.profilePicture}
                        sx={{cursor: 'pointer', width: 48, height: 48}}
                        onClick={() => navigate(`/profiledashboard/${creator?._id}/profilemain`)}
                    />

                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
                        <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                            {creator?.name} {creator?.lastName}
                            <Typography 
                                component='span' 
                                color='text.secondary'
                                fontSize={11}
                                fontWeight={400}
                            >
                                {isFollowByMe(creator?._id) && ' · following'}
                            </Typography>
                        </Typography>

                        <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                            {creator?.job}
                        </Typography>

                        <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                            {getFollowersCount(creator?._id)} followers · {getTimeAgo(card.createdAt)}
                        </Typography>

                    </Box>
                </Box>


                {/* Right: Follow button */}
                {user && user._id !== creator?._id && !isFollowByMe(creator?._id) &&(
                    <Button
                        size='small'
                        variant={'outlined'}
                        startIcon={<PersonAddIcon/>}
                        onClick={async () => {
                            await toggleFollow(creator?._id)
                            await refreshFeed();
                        }}
                        sx={{
                            fontSize: 9, 
                            minWidth: 70, 
                            borderRadius: 5, 
                            py: 0.3,
                            m: 2,
                            '& .MuiButton-startIcon' : {mb: 0.2}, lineHeight: 0 
                        }}
                    >
                        Follow
                    </Button>
                )}
            </Box>

            <Box sx={{px:2, flex: 1}} >
                {/* Title */}
                {card.title && (
                    <Typography component='div' fontWeight={600} fontSize={20} mb={1}>
                        {card.title}
                    </Typography>
                )}
                {/* Category */}
                {card.category && (
                    <Chip 
                        label={card.category} 
                        size='small' 
                        fontSize={14} 
                        sx={{mb:1}}
                    />
                )}

                {/* Contnet */}
                {card.content && (
                    <Typography component='div' fontWeight={400} fontSize={14} mb={1} sx={{whiteSpace: 'pre-wrap'}}>

                        {isExpanded ? card.content : card.content.slice(0, 150)}

                        {card.content.length > 150 && (
                            <span
                                onClick={() => setIsExpanded(!isExpanded)}
                                style={{
                                    color: theme.palette.primary.main, 
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    marginLeft: 4

                                }}
                            >
                                {isExpanded ? '...showless' : '...read more'}
                            </span>
                        )}

                    </Typography>
                )}


                {/* URL */}
                {card.web && (
                    <Button
                        size='small'
                        variant='outlined'
                        href={card.web}
                        startIcon={<LaunchIcon/>}
                        target='_blank'
                        rel='noreferrer'
                        sx={{mb:1, borderRadius: 5, fontSize: 11}}
                    >
                        Visit Link
                    </Button>
                )}

            </Box>

            {/* Media display */}

            <Box onClick={isLoggedIn ? onOpenCard : () => setIsLoginPopupOpen(true)} sx={{cursor: 'pointer'}}>
                <MediaDisplay
                    mediaUrl={card.mediaUrl}
                    mediaType={card.mediaType}
                    style={{
                        width: '100%', 
                        // height: '100%', 
                        objectFit: 'cover'
                    }}
                />
            </Box>

            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1
            }}>
                {/* left: ovelapping avatars */}
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>

                    {/* Avatars */}
                    <Box sx={{display: 'flex'}}>
                        {getLikesUsers.map((likedUser, index) => (
                            <Avatar
                                key={likedUser._id}
                                src={likedUser.profilePicture}
                                sx={{
                                    width: 30,
                                    height: 30,
                                    ml: index === 0 ? 0 : -0.8,
                                    border: '1.5px solid',
                                    borderColor: 'background.paper'
                                }}
                            />
                        ))}
                    </Box>

                    {/* Count */}
                    <Typography component={'div'} fontSize={13} color='text.secondary'>
                        {getLikeCount(card._id)} likes
                    </Typography>
                </Box>

                {/* Right */}
                <Typography component={'div'} fontSize={13} color='text.secondary'>
                    {countComments(card._id)} comments
                </Typography>
            </Box>

            <Divider sx={{my: 1}}/>

            <Box sx={{
                display: 'flex', 
                gap: 1, 
                mb: 1, 
                justifyContent: 'space-between',
                px: 1
            }}>

                {/* Favorite */}
                {isSavedCard ? (
                    <Button
                        size='small'
                        startIcon={<BookmarkAddedIcon/>}
                        onClick={() => isLoggedIn ? onRemoveSavedCard() : setIsLoginPopupOpen(true)}
                        >
                        saved
                    </Button>
                ) : (
                    <Button
                        size='small'
                        startIcon={<BookmarkBorderOutlinedIcon/>}
                        onClick={() => isLoggedIn ? onSaveCard() : setIsLoginPopupOpen(true)}
                        >
                        save
                    </Button>
                )}

                {/* Like */}
                <Button
                    size='small'
                    startIcon={isLikeByMe(card._id) ? <ThumbUpIcon/> : <ThumbUpOffAltIcon/>}
                    onClick={() => isLoggedIn ? toggleLike(card._id) : setIsLoginPopupOpen(true)}
                >
                    {isLikeByMe(card._id) ? "Unlike" : "Like"}
                </Button>

                {/* Comment */}
                <Button
                    size='small'
                    startIcon={<ChatBubbleOutlineIcon/>}
                    onClick={() => { 
                        isLoggedIn ? setOpenCommentCardId(openCommentCardId === card._id ? null : card._id) &&
                        inputRef.current && inputRef.current.focus() : setIsLoginPopupOpen(true)
                    }}   
                >
                    comment
                </Button>
            </Box>
            
            {openCommentCardId === card._id && (
                <CardsComments
                    card = {card}
                    users={users}
                    addComment={addComment}
                    removeComment = {removeComment}
                    focusRef = {inputRef}
                />
            )}

            {isLoginPopupOpen && (
                <LoginPopup
                    onCloseLoginPopup={onCloseLoginPopup}
                />
            )}

        </Box>

    </Box>
  )
}
