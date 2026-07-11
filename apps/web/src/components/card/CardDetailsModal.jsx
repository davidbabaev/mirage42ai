import { useCardsProvider } from '../../providers/CardsProvider';
import { useAuth } from '../../providers/AuthProvider';
import useFavoriteCards from '../../hooks/useFavoriteCards';
import CardsComments from '../CardsComments';
import { getCard } from '../../services/apiService';

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import useLikedCards from '../../hooks/useLikedCards';
import useCommentsCards from '../../hooks/useCommentsCards';
import getTimeAgo from '../../utils/getTimeAgo';
import MediaDisplay from '../MediaDisplay';
import LoginPopup from '../LoginPopup';
import { Avatar, Box, Button, Chip, Divider, IconButton, Menu, MenuItem, Snackbar, Typography, useTheme } from '@mui/material';
import useFollowUser from '../../hooks/useFollowUser';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LaunchIcon from '@mui/icons-material/Launch';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import ShareDialog from '../ShareDialog';
import LikesModal from '../LikesModal';
import ReportPostDialog from './ReportPostDialog';
import OnLoadingSkeletonBox from '../OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';

export default function CardDetailsModal({cardId, onClose, highlightCommentId}) {

        const {registeredCards, feedCards} = useCardsProvider()
        const {favoriteCards, handleFavoriteCards} = useFavoriteCards();
        const {users} = useUsersProvider();
        const {user} = useAuth();
        const {toggleFollow, isFollowByMe, getFollowersCount} = useFollowUser();
        const [isExpanded, setIsExpanded] = useState(false)
        const [isShareOpen, setIsShareOpen] = useState(false)
        const [isLikesModalOpen, setIsLikesModalOpen] = useState(false)
        const [menuAnchorEl, setMenuAnchorEl] = useState(null);
        const [isReportOpen, setIsReportOpen] = useState(false);
        const [hasReported, setHasReported] = useState(false);
        const [toast, setToast] = useState('');
        const theme = useTheme();

        // Fallback fetch: used when the card isn't already in local state (e.g.
        // deep-linked / opened before the full card list has loaded).
        const [fetchedCard, setFetchedCard] = useState(null);
        const [fetchLoading, setFetchLoading] = useState(false);
        const [fetchError, setFetchError] = useState(null);

        const [, setIsLoginPopupOpen] = useState(false);
        const {addComment, countComments, removeComment} = useCommentsCards();
        const navigate = useNavigate();

        const inputRef = useRef(null);

        const {toggleLike, isLikeByMe, getLikeCount} = useLikedCards()

        // Prefer a live card from local state (registeredCards or feedCards) so
        // optimistic-like updates for already-loaded cards keep working.
        const localCard =
            registeredCards.find((card) => card._id === cardId) ||
            feedCards.find((card) => card._id === cardId);

        // When there is no local card, fire a one-shot fetch. The effect re-runs
        // only when cardId changes, so it doesn't loop.
        useEffect(() => {
            if (localCard) {
                setFetchedCard(null);
                setFetchError(null);
                return;
            }
            let cancelled = false;
            setFetchLoading(true);
            setFetchError(null);
            getCard(cardId)
                .then((card) => { if (!cancelled) setFetchedCard(card); })
                .catch((err) => { if (!cancelled) setFetchError(err.message || 'Not found'); })
                .finally(() => { if (!cancelled) setFetchLoading(false); });
            return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [cardId]);

        const currentCard = localCard || fetchedCard;

        if (!currentCard) {
            if (fetchError) {
                return (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                            This post could not be loaded.
                        </Typography>
                    </Box>
                );
            }
            if (fetchLoading) return <OnLoadingSkeletonBox />;
            return <OnLoadingSkeletonBox />;
        }
        
        const creator = users.find((userC) => userC._id === currentCard.userId)

        // Use server-embedded likePreview when available (feed cards) to avoid
        // scanning the global users array. Fall back to the users array for
        // non-feed surfaces that don't yet carry the embed.
        const getLikesUsers = currentCard.likePreview != null
            ? currentCard.likePreview.slice(0, 4)
            : users.filter((u) => currentCard.likes.includes(u._id)).slice(0, 4);

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
                videoMode="modal"
                zoomable
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


                {/* Right: Follow button + overflow menu */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {user && user._id !== creator?._id && !isFollowByMe(creator?._id) && (
                        <Button
                            size='small'
                            variant={'outlined'}
                            startIcon={<PersonAddIcon/>}
                            onClick={async () => {
                                await toggleFollow(creator?._id)
                            }}
                            sx={{ fontSize: 10, minWidth: 70 }}
                        >
                            Follow
                        </Button>
                    )}

                    {/* ⋯ overflow — only shown to other users (not own post) */}
                    {user && user._id !== creator?._id && (
                        <>
                            <IconButton
                                aria-label="Post options"
                                size="small"
                                onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                                sx={{ minWidth: 44, minHeight: 44 }}
                            >
                                <MoreHorizIcon fontSize="small" />
                            </IconButton>

                            <Menu
                                anchorEl={menuAnchorEl}
                                open={Boolean(menuAnchorEl)}
                                onClose={() => setMenuAnchorEl(null)}
                            >
                                <MenuItem
                                    disabled={hasReported}
                                    onClick={() => {
                                        setMenuAnchorEl(null);
                                        setIsReportOpen(true);
                                    }}
                                >
                                    <FlagOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                                    {hasReported ? 'Reported' : 'Report post'}
                                </MenuItem>
                            </Menu>
                        </>
                    )}
                </Box>
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
                    {/* left: overlapping avatars + likes count — clickable when >0 */}
                    {getLikeCount(currentCard._id) > 0 ? (
                        <Box
                            component='button'
                            aria-label={`View ${getLikeCount(currentCard._id)} likes`}
                            onClick={() => setIsLikesModalOpen(true)}
                            sx={{
                                display: 'flex', alignItems: 'center', gap: 1,
                                background: 'none', border: 'none', p: 0,
                                cursor: 'pointer', minHeight: 44, minWidth: 44,
                                color: 'inherit',
                            }}
                        >
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
                            <Typography component='span' fontSize={13} color='text.secondary'>
                                {getLikeCount(currentCard._id)} likes
                            </Typography>
                        </Box>
                    ) : (
                        <Typography component='div' fontSize={13} color='text.secondary'>
                            No likes yet
                        </Typography>
                    )}

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

                    {/* Share */}
                    <Button
                        size='small'
                        startIcon={<ShareOutlinedIcon/>}
                        onClick={() => setIsShareOpen(true)}
                    >
                        share
                    </Button>
                </Box>

                {isShareOpen && (
                    <ShareDialog card={currentCard} open={isShareOpen} onClose={() => setIsShareOpen(false)}/>
                )}

                {isLikesModalOpen && (
                    <LikesModal
                        open={isLikesModalOpen}
                        onClose={() => setIsLikesModalOpen(false)}
                        cardId={currentCard._id}
                        likeCount={getLikeCount(currentCard._id)}
                    />
                )}


                {/* Comment input */}
                {/* comments */}
                <CardsComments
                    card={currentCard}
                    users={users}
                    addComment={addComment}
                    removeComment={removeComment}
                    focusRef={inputRef}
                    closeOnNav={onClose}
                    highlightCommentId={highlightCommentId}
                />

                {isReportOpen && (
                    <ReportPostDialog
                        open={isReportOpen}
                        onClose={() => setIsReportOpen(false)}
                        cardId={currentCard._id}
                        onSuccess={(alreadyReported) => {
                            setIsReportOpen(false);
                            setHasReported(true);
                            setToast(alreadyReported
                                ? "You've already reported this post."
                                : "Thanks for your report. We'll look into it.");
                        }}
                    />
                )}

                <Snackbar
                    open={!!toast}
                    autoHideDuration={3000}
                    onClose={() => setToast('')}
                    message={toast}
                />
            </Box>
        </Box>
    </Box>
  )
}
