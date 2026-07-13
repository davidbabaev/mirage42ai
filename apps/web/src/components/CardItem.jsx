import React, { useRef, useState } from 'react'
import { useAuth } from '../providers/AuthProvider';
import useLikedCards from '../hooks/useLikedCards';
import { useNavigate } from 'react-router-dom';
import useCommentsCards from '../hooks/useCommentsCards';
import CardsComments from './CardsComments';
import LoginPopup from './LoginPopup';
import getTimeAgo from '../utils/getTimeAgo';
import MediaDisplay from './MediaDisplay';
import { Avatar, Box, Button, Chip, Divider, IconButton, Menu, MenuItem, Snackbar, Typography, useTheme } from '@mui/material';
import useFollowUser from '../hooks/useFollowUser';
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
import ShareDialog from './ShareDialog';
import LikesModal from './LikesModal';
import ReportPostDialog from './card/ReportPostDialog';

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
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [hasReported, setHasReported] = useState(false);
    const [toast, setToast] = useState('');
    function onCloseLoginPopup(){
        setIsLoginPopupOpen(false)
    }
    
    const {addComment, countComments, removeComment} = useCommentsCards();
    const {toggleFollow, isFollowByMe, getFollowersCount} = useFollowUser();
    const [isExpanded, setIsExpanded] = useState(false)
    const theme = useTheme();
    const inputRef = useRef(null);    

    const navigate = useNavigate();
    const {toggleLike, isLikeByMe, getLikeCount} = useLikedCards()
    const {user, isLoggedIn} = useAuth();

    // Both come embedded on the card from the server. There is no global users
    // array to fall back to any more — and none is needed.
    const creator = card.creator;
    const getLikesUsers = (card.likePreview ?? []).slice(0, 4);

    // A banned/removed post (only admins ever see one in the feed). Cards with no
    // status set are treated as active — that's the default for every normal post.
    const isActiveCard = !card.status || card.status === 'active';

    const cardRef = useRef(null);

    // Defensive: pause this card's video at click time so even if the modal's
    // own mount sweep is deferred (lazy import / Suspense boundary added in
    // future) or skipped (render error inside CardDetailsModal), the feed
    // video still stops. Today, React's batched commit + synchronous useEffect
    // means the modal sweep alone would also pause it; this is belt-and-
    // suspenders, not a bug fix on its own.
    const handleCardClick = (e) => {
        // Cancel the browser's native click-to-play/pause toggle on the feed
        // <video controls>. Without this, the same click that opens the modal
        // re-plays the video a frame after we pause it, so it keeps playing
        // behind the modal.
        e.preventDefault();
        if(!isLoggedIn){
            setIsLoginPopupOpen(true);
            return;
        }
        cardRef.current?.querySelectorAll('video').forEach(v => v.pause());
        onOpenCard();
    }

  return (
        <Box sx={(theme) => ({
            // Mobile (xs): full-bleed, edge-to-edge post like the Instagram /
            // Facebook mobile feed. The 100vw + calc(50% - 50vw) break-out
            // escapes the Container/Grid horizontal gutter so the media runs
            // flush to both screen edges regardless of the parent padding.
            // Desktop (md+): floating, bordered, rounded card.
            width: {xs: '100vw', md: '100%'},
            mx: {xs: 'calc(50% - 50vw)', md: 0},
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            borderRadius: {xs: 0, md: 3},
            // The divider colour is baked INTO the border shorthand so it never
            // falls back to currentColor (which is white text colour in dark
            // mode — that was the "white border" bug). Desktop: soft hairline
            // all around. Mobile: edge-to-edge with only a soft separator line
            // between posts (reads in both light and dark) plus a small
            // IG/Facebook-style gap (mb below).
            border: {xs: 'none', md: `0.5px solid ${theme.palette.divider}`},
            borderBottom: {xs: `1px solid ${theme.palette.divider}`, md: `0.5px solid ${theme.palette.divider}`},
            mt: {xs: 0, md: 2},
            mb: {xs: 1, md: 2},
          })}>
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
                            {getFollowersCount(creator)} followers · {getTimeAgo(card.createdAt)}
                        </Typography>

                    </Box>
                </Box>


                {/* Right: Follow button + overflow menu.
                    The own-post checks key on card.userId, not creator._id — the
                    card's author id is always present, so "is this mine?" can never
                    depend on whether the author object resolved. */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, m: 1 }}>
                    {user && String(user._id) !== String(card.userId) && !isFollowByMe(creator?._id) && (
                        <Button
                            size='small'
                            variant={'outlined'}
                            startIcon={<PersonAddIcon/>}
                            onClick={async () => {
                                await toggleFollow(creator)
                            }}
                            sx={{
                                fontSize: 9,
                                minWidth: 70,
                                borderRadius: 5,
                                py: 0.3,
                                '& .MuiButton-startIcon': { mb: 0.2 }, lineHeight: 0
                            }}
                        >
                            Follow
                        </Button>
                    )}

                    {/* ⋯ overflow — only shown to other users (not own post) */}
                    {user && String(user._id) !== String(card.userId) && (
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
                                {isExpanded ? '...show less' : '...read more'}
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

            <Box ref={cardRef} onClick={handleCardClick} sx={{cursor: 'pointer', overflow: 'hidden', position: 'relative'}}>
                <MediaDisplay
                    mediaUrl={card.mediaUrl}
                    mediaType={card.mediaType}
                    videoMode="feed"
                    style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '600px',
                        objectFit: 'cover',
                        objectPosition: 'top',
                        display: 'block',
                    }}
                />
                {/* Video posts render native <video controls>, whose controls
                    swallow the tap on mobile so it never bubbles to this Box's
                    onClick. A transparent overlay above the video catches the
                    tap and lets it bubble to handleCardClick, so video posts
                    open the modal just like image posts do. */}
                {card.mediaType === 'video' && (
                    <Box sx={{position: 'absolute', inset: 0, zIndex: 1}} />
                )}
            </Box>

            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1,
                pt: 1
            }}>
                {/* left: overlapping avatars + likes count — clickable when >0 */}
                {getLikeCount(card) > 0 ? (
                    <Box
                        component='button'
                        aria-label={`View ${getLikeCount(card)} likes`}
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
                            {getLikeCount(card)} likes
                        </Typography>
                    </Box>
                ) : (
                    <Typography component='div' fontSize={13} color='text.secondary'>
                        No likes yet
                    </Typography>
                )}

                {/* Right */}
                <Typography component={'div'} fontSize={13} color='text.secondary'>
                    {countComments(card)} comments
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

                {/* Favorite.
                    Hidden on a banned post: the server refuses to save one (404), so
                    the button could only ever fail and silently revert. Only admins
                    see banned posts in the feed at all. Hidden rather than disabled —
                    a dead control on a removed post is just noise. */}
                {isActiveCard ? (
                    isSavedCard ? (
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
                    )
                ) : <Box />}

                {/* Like */}
                <Button
                    size='small'
                    startIcon={isLikeByMe(card) ? <ThumbUpIcon/> : <ThumbUpOffAltIcon/>}
                    onClick={() => isLoggedIn ? toggleLike(card) : setIsLoginPopupOpen(true)}
                >
                    {isLikeByMe(card) ? "Unlike" : "Like"}
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

                {/* Share */}
                <Button
                    size='small'
                    startIcon={<ShareOutlinedIcon/>}
                    onClick={() => isLoggedIn ? setIsShareOpen(true) : setIsLoginPopupOpen(true)}
                >
                    share
                </Button>
            </Box>

            {isShareOpen && (
                <ShareDialog card={card} open={isShareOpen} onClose={() => setIsShareOpen(false)}/>
            )}

            {isLikesModalOpen && (
                <LikesModal
                    open={isLikesModalOpen}
                    onClose={() => setIsLikesModalOpen(false)}
                    cardId={card._id}
                    likeCount={getLikeCount(card)}
                />
            )}
            
            {openCommentCardId === card._id && (
                <CardsComments
                    card = {card}
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

            {isReportOpen && (
                <ReportPostDialog
                    open={isReportOpen}
                    onClose={() => setIsReportOpen(false)}
                    cardId={card._id}
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
  )
}
