import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../providers/AuthProvider';
import { Avatar, Box, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import useFollowUser from '../hooks/useFollowUser';
import useLikedComments from '../hooks/useLikedComments';
import useReplyComments from '../hooks/useReplyComments';
import getTimeAgo from '../utils/getTimeAgo';
import { useNavigate } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

export default function CardsComments({card, users, addComment, removeComment, focusRef, closeOnNav, highlightCommentId}) {

    const [commentText, setCommentText] = useState('');
    const {user: loggedInUser} = useAuth();
    const [commentsCount, setCommentsCount] = useState(5);
    const [isLoading, setIsLoading] = useState(false)
    // ID of the comment currently being highlighted (background flash + outline).
    const [highlightedId, setHighlightedId] = useState(null)
    // Refs keyed by comment._id so we can scrollIntoView after render.
    const commentRefs = useRef(new Map())
    const navigate = useNavigate();

    // Reply state: only one reply box is open at a time (replyingTo = commentId).
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isReplyLoading, setIsReplyLoading] = useState(false);


    // Scroll to + highlight a specific comment when `highlightCommentId` is set
    // (e.g. opening a post via a comment-like / comment-reply notification).
    useEffect(() => {
        if (!highlightCommentId || !card?.comments) return

        const allComments = [...card.comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const idx = allComments.findIndex(c => c._id === highlightCommentId)

        if (idx < 0) return // comment not found (deleted) — open post without error

        // Ensure the target comment is within the visible slice.
        setCommentsCount(prev => Math.max(prev, idx + 1))

        setHighlightedId(highlightCommentId)

        // Small delay lets the commentsCount update flush to the DOM before we scroll.
        const scrollTimer = setTimeout(() => {
            const el = commentRefs.current.get(highlightCommentId)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)

        // Remove the highlight after 2.2s (the CSS transition then fades it out).
        const fadeTimer = setTimeout(() => setHighlightedId(null), 2200)

        return () => {
            clearTimeout(scrollTimer)
            clearTimeout(fadeTimer)
        }
    }, [highlightCommentId]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (e) => {
        try{
            setIsLoading(true)
            e.preventDefault();
            await addComment(commentText, card._id)
            setCommentText('');
        }
        finally{
            setIsLoading(false)
        }
    }

    const {toggleFollow, isFollowByMe, getFollowersCount} = useFollowUser();
    const {toggleCommentLike, isCommentLikedByMe, getCommentLikeCount} = useLikedComments();
    const {addReply} = useReplyComments();

    const handleReplySubmit = async (commentId, e) => {
        e?.preventDefault?.();
        if(!replyText.trim()) return;
        try{
            setIsReplyLoading(true)
            await addReply(card._id, commentId, replyText)
            setReplyText('');
            setReplyingTo(null);
        }
        finally{
            setIsReplyLoading(false)
        }
    }


    const countedComments = (card?.comments || []).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, commentsCount)

  return (
    <Box sx={{p:1}}>
        {loggedInUser && (
            <Box sx={{display: 'flex', gap: 1, alignItems: 'center', mb: 2}}>
                <Avatar
                    src={loggedInUser.profilePicture}
                    sx={{width: 36, height: 36}}
                />

                <TextField
                    inputRef={focusRef}
                    fullWidth
                    size='small'
                    multiline
                    placeholder='Write your opinion..'
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && commentText.trim() && handleSubmit(e)}
                    sx={{
                        '& .MuiOutlinedInput-root':{
                            borderRadius: 5,
                            fontSize: 13
                        }
                    }}
                />   

                <Button
                    type='submit'
                    variant='contained'
                    loading={isLoading}
                    loadingPosition='start'
                    disabled={!commentText.trim()}
                    sx={{ml: 'auto', borderRadius: 5, minWidth: 90, fontSize: 12}}
                    onClick={handleSubmit}
                    color='primary'
                >
                    {isLoading ? "send.." : "Send"}
                </Button>

                
            </Box>   
        )}

        {/* Comments List */}
        <Box>
            {countedComments.length === 0 && 
                <Typography
                    fontSize={12}
                    color='text.secondary'
                >ther'es no comments yet</Typography>
            }

            {countedComments.map((comment) => {
                const userComment = users.find(u => u._id === comment.userId);
                const isHighlighted = highlightedId === comment._id

                return(
                    <Box
                        key={comment._id}
                        ref={el => {
                            if (el) commentRefs.current.set(comment._id, el)
                            else commentRefs.current.delete(comment._id)
                        }}
                        sx={{
                            borderRadius: 2,
                            px: 0.5,
                            // Highlight: background flash + outline as non-color cue.
                            // Instant-on when highlighted, fades out when removed (~0.6s).
                            bgcolor: isHighlighted ? 'warning.light' : 'transparent',
                            outline: isHighlighted ? '2px solid' : '0px solid',
                            outlineColor: 'warning.main',
                            transition: 'background-color 0.6s ease-out, outline-width 0.4s ease-out',
                        }}
                    >

                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                        }}>
                            {/* left avatar + info */}
                            <Box sx={{display: 'flex', gap: 1.5}}>
                                <Avatar
                                    src={userComment?.profilePicture}
                                    sx={{cursor: 'pointer', width: 36, height: 36}}
                                    onClick={() => {
                                        navigate(`/profiledashboard/${userComment?._id}/profilemain`)
                                        closeOnNav()
                                }}
                                />
            
                                <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
                                    <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                                        {userComment?.name} {userComment?.lastName}
                                        <Typography 
                                            component='span' 
                                            color='text.secondary'
                                            fontSize={11}
                                            fontWeight={400}
                                        >
                                            {isFollowByMe(userComment?._id) && ' · following'}
                                        </Typography>
                                    </Typography>
            
                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {userComment?.job}
                                    </Typography>
            
                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {getFollowersCount(userComment?._id)} followers · {getTimeAgo(comment.createdAt)}
                                    </Typography>
            
                                </Box>
                            </Box>
            
            
                         <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                            {/* Right: like heart + count, then Follow / Delete */}
                            {loggedInUser && (
                                <Box sx={{display: 'flex', alignItems: 'center'}}>
                                    <Tooltip title={isCommentLikedByMe(comment) ? 'Unlike' : 'Like'}>
                                        <IconButton
                                            size='small'
                                            onClick={() => toggleCommentLike(card._id, comment._id)}
                                            sx={{color: isCommentLikedByMe(comment) ? 'error.main' : 'text.secondary'}}
                                        >
                                            {isCommentLikedByMe(comment)
                                                ? <FavoriteIcon sx={{fontSize: 16}}/>
                                                : <FavoriteBorderIcon sx={{fontSize: 16}}/>}
                                        </IconButton>
                                    </Tooltip>
                                    {getCommentLikeCount(comment) > 0 && (
                                        <Typography fontSize={12} color='text.secondary'>
                                            {getCommentLikeCount(comment)}
                                        </Typography>
                                    )}
                                </Box>
                            )}

                            {/* Right: Follow button */}

                            {loggedInUser && loggedInUser._id !== userComment?._id && !isFollowByMe(userComment?._id) &&(
                                <Button
                                    size='small'
                                    variant={'outlined'}
                                    startIcon={<PersonAddIcon/>}
                                    onClick={async () => {
                                        await toggleFollow(userComment?._id)
                                    }}
                                    sx={{fontSize: 9, minWidth: 70, borderRadius: 5, py: 0.3,
                                        '& .MuiButton-startIcon' : {mb: 0.2}, lineHeight: 0 
                                    }}
                                >
                                    Follow
                                </Button>
                            )}

                            {loggedInUser && 
                                (loggedInUser._id === comment.userId || loggedInUser._id === card.userId || loggedInUser.isAdmin
                            ) && (
                                <Tooltip title="Delete Comment">
                                    <IconButton 
                                        size='small'
                                        onClick={() => removeComment(card._id, comment._id)}
                                        sx={{border: '1px solid', borderColor: 'text.secondary'}}
                                    >
                                        <DeleteIcon sx={{fontSize: 14}}/>
                                    </IconButton>
                                </Tooltip>
                            )
                            }
                        </Box>


                        </Box>

                        <Box sx={{mb: 2, pl: 6, mt:1}}>
                            <Typography sx={{fontSize: 14, lineHeight: 1.2, whiteSpace: 'pre-wrap'}}>
                                {comment.commentText}
                            </Typography>

                            {/* Reply action */}
                            {loggedInUser && (
                                <Button
                                    size='small'
                                    onClick={() => {
                                        setReplyingTo(replyingTo === comment._id ? null : comment._id)
                                        setReplyText('')
                                    }}
                                    sx={{fontSize: 11, textTransform: 'none', minWidth: 0, p: 0, mt: 0.5, color: 'text.secondary'}}
                                >
                                    Reply
                                </Button>
                            )}

                            {/* Replies (single-level, oldest first) */}
                            {(comment.replies || [])
                                .slice()
                                .sort((a,b) => a.createdAt.localeCompare(b.createdAt))
                                .map((reply) => {
                                    const replyUser = users.find(u => u._id === reply.userId);
                                    return (
                                        <Box key={reply._id} sx={{display: 'flex', gap: 1, mt: 1.5}}>
                                            <Avatar
                                                src={replyUser?.profilePicture}
                                                sx={{width: 28, height: 28, cursor: 'pointer'}}
                                                onClick={() => {
                                                    navigate(`/profiledashboard/${replyUser?._id}/profilemain`)
                                                    closeOnNav()
                                                }}
                                            />
                                            <Box>
                                                <Typography component='div' fontWeight={600} fontSize={12} lineHeight={1.2}>
                                                    {replyUser?.name} {replyUser?.lastName}
                                                    <Typography component='span' color='text.secondary' fontSize={10} fontWeight={400} sx={{ml: 0.5}}>
                                                        {getTimeAgo(reply.createdAt)}
                                                    </Typography>
                                                </Typography>
                                                <Typography sx={{fontSize: 13, lineHeight: 1.2, whiteSpace: 'pre-wrap'}}>
                                                    {reply.replyText}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )
                                })}

                            {/* Reply input */}
                            {loggedInUser && replyingTo === comment._id && (
                                <Box sx={{display: 'flex', gap: 1, alignItems: 'center', mt: 1.5}}>
                                    <Avatar src={loggedInUser.profilePicture} sx={{width: 28, height: 28}}/>
                                    <TextField
                                        fullWidth
                                        autoFocus
                                        size='small'
                                        multiline
                                        placeholder={`Reply to ${userComment?.name || ''}...`}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && replyText.trim() && handleReplySubmit(comment._id, e)}
                                        sx={{'& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
                                    />
                                    <Button
                                        variant='contained'
                                        size='small'
                                        loading={isReplyLoading}
                                        disabled={!replyText.trim()}
                                        onClick={(e) => handleReplySubmit(comment._id, e)}
                                        sx={{borderRadius: 5, minWidth: 70, fontSize: 11}}
                                    >
                                        Reply
                                    </Button>
                                </Box>
                            )}
                        </Box>

                    </Box>
                )
            })}

            {commentsCount <= (card?.comments || []).length && (
                    <Button 
                        size='small'
                        sx={{
                            fontSize: 11,
                            border: '1px solid',
                            borderRadius: 5,
                            px:2
                        }}
                        onClick={() => setCommentsCount(commentsCount + 5)}
                    >
                        Read More..
                    </Button>
            )}
        </Box>

    </Box>
  )
}
