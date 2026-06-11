import { useCardsProvider } from '../../providers/CardsProvider';
import { useAuth } from '../../providers/AuthProvider'; 
import useFavoriteCards from '../../hooks/useFavoriteCards';
import CardsComments from '../CardsComments';

import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import useLikedCards from '../../hooks/useLikedCards';
import useCommentsCards from '../../hooks/useCommentsCards';
import getTimeAgo from '../../utils/getTimeAgo';
import MediaDisplay from '../MediaDisplay';
import LoginPopup from '../LoginPopup';
import { Avatar, Box, Button, Chip, Divider, Typography, useTheme } from '@mui/material';
import useFollowUser from '../../hooks/useFollowUser';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LaunchIcon from '@mui/icons-material/Launch';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import OnLoadingSkeletonBox from '../OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';

export default function CardDetailsModal({cardId, onClose}) {

        const {registeredCards} = useCardsProvider()
        const {favoriteCards, handleFavoriteCards} = useFavoriteCards();
        const {users} = useUsersProvider();
        const {user} = useAuth();
        const {toggleFollow, isFollowByMe, getFollowingCount, getFollowersCount} = useFollowUser();
        const [isExpanded, setIsExpanded] = useState(false)
        const theme = useTheme();

        const {refreshFeed} = useCardsProvider();

        const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
        function onCloseLoginPopup(){
            setIsLoginPopupOpen(false)
        }
        const {addComment, countComments, removeComment} = useCommentsCards();
        const navigate = useNavigate();

        const inputRef = useRef(null);
    
        const {toggleLike, isLikeByMe, getLikeCount} = useLikedCards()
    
        const currentCard = registeredCards.find((card) => card._id === cardId);
        
            if(!currentCard){
                return <OnLoadingSkeletonBox/>
            }
        
        const creator = users.find((userC) => userC._id === currentCard.userId)

        const getLikesUsers = users.filter((u) => currentCard.likes.includes(u._id)).slice(0,4)

  return (
    <Box sx={{
        display: 'flex', 
        flexDirection: {xs: 'column',md: 'row'},
        minHeight: {xs: 'auto',md:'min(60vh, 400px)'}, 
        maxHeight: {xs: 'none',md:'min(75vh, 680px)'},
        overflowY: {xs: 'auto', md: 'hidden'}
    }}>
        {/* Left Media */}

        <Box sx={{
            flex: {xs:'none', md:1}, 
            bgcolor: 'black',
        }}>
            {/* Media display */}
            <MediaDisplay
                mediaUrl={currentCard.mediaUrl}
                mediaType={currentCard.mediaType}
                style={{
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain',
                    display: 'block',
                }}
            />
        </Box>


        {/* Right Media */}
        <Box sx={{
            width: {xs: '100%',md:380}, 
            display: 'flex', 
            flexDirection: 'column', 
            maxHeight: {xs: 'none',md: 'min(75vh, 680px)'},
            overflow: {xs: 'visible', md: 'auto'}
        }}>
            
            
            {/* Creator flow */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                py: 2,
                pr: {xs: 0, md:3.5},
                borderBottom: '1px solid',
                borderColor: 'divider',
                mx:2,
                }}>

                {/* left avatar + info */}
                <Box sx={{display: 'flex', gap: 1.5}}>
                    <Avatar
                        src={creator?.profilePicture}
                        sx={{cursor: 'pointer', width: 48, height: 48}}
                        onClick={() => {
                            navigate(`/profiledashboard/${creator?._id}/profilemain`)
                            onClose()
                        }}
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
                            {getFollowersCount(creator?._id)} followers · {getTimeAgo(currentCard.createdAt)}
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
                            await refreshFeed()
                        }}
                        sx={{fontSize: 10, minWidth: 70}}
                    >
                        Follow
                    </Button>
                )}
            </Box>

            <Box sx={{overflow: 'auto', p:2, flex: 1, pb:{xs:2, md:0}}} >
                {/* Title */}
                {currentCard.title && (
                    <Typography component='div' fontWeight={600} fontSize={20} mb={1}>
                        {currentCard.title}
                    </Typography>
                )}
                {/* Category */}
                {currentCard.category && (
                    <Chip 
                        label={currentCard.category} 
                        size='small' 
                        fontSize={14} 
                        sx={{mb:1}}
                    />
                )}

                {/* Contnet */}
                {currentCard.content && (
                    <Typography component='div' fontWeight={400} fontSize={14} mb={1} sx={{whiteSpace: 'pre-wrap'}}>

                        {isExpanded ? currentCard.content : currentCard.content.slice(0, 150)}

                        {currentCard.content.length > 150 && (
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
                {currentCard.web && (
                    <Button
                        size='small'
                        variant='outlined'
                        href={currentCard.web}
                        startIcon={<LaunchIcon/>}
                        target='_blank'
                        rel='noreferrer'
                        sx={{mb:1, borderRadius: 5, fontSize: 11}}
                    >
                        Visit Link
                    </Button>
                )}

                <Divider sx={{my: 1, borderColor: 'background.paper'}}/>

                {/* likes + comment - counts */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1
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
                            {getLikeCount(currentCard._id)} likes
                        </Typography>
                    </Box>

                    {/* Right */}
                    <Typography component={'div'} fontSize={13} color='text.secondary'>
                        {countComments(currentCard._id)} comments
                    </Typography>
                </Box>

                <Divider sx={{my: 2}}/>

                {/* Action buttons */}


                <Box sx={{display: 'flex', gap: 1, mb: 2, justifyContent: 'space-between'}}>
                    {/* Favorite */}
                    <Button
                        size='small'
                        startIcon={favoriteCards.some(c => c._id === currentCard._id) ? <BookmarkAddedIcon/> : <BookmarkBorderOutlinedIcon/>}
                        onClick={() => user ? handleFavoriteCards(currentCard) : setIsLoginPopupOpen(true)}
                        >
                        {favoriteCards.some(c => c._id === currentCard._id) ? 'saved' : 'save'}
                    </Button>

                    {/* Like */}
                    <Button
                        size='small'
                        startIcon={isLikeByMe(currentCard._id) ? <ThumbUpIcon/> : <ThumbUpOffAltIcon/>}
                        onClick={() => toggleLike(currentCard._id)}
                    >
                        {isLikeByMe(currentCard._id) ? "Unlike" : "Like"}
                    </Button>

                    {/* Comment */}
                    <Button
                        size='small'
                        startIcon={<ChatBubbleOutlineIcon/>}
                        onClick={() => inputRef.current && inputRef.current.focus()}
                    >
                        comment 
                    </Button>
                </Box>


                {/* Comment input */}
                {/* comments */}
                <CardsComments
                    card = {currentCard}
                    users={users}
                    addComment={addComment}
                    removeComment = {removeComment}
                    focusRef = {inputRef}
                    closeOnNav = {onClose}
                />
            </Box>
        </Box>
    </Box>
  )
}
