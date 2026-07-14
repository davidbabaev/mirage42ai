import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../providers/authContext';
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
import InfiniteScroll from './InfiniteScroll';
import { useCursorPagination } from '../hooks/useCursorPagination';
import { getCardComments } from '../services/apiService';

// No `users` prop any more: every comment and reply carries its `author` embedded
// from the server, so there is nothing to look up in a global array.
export default function CardsComments({card, addComment, removeComment, focusRef, closeOnNav, highlightCommentId, scrollRoot = null}) {

    const [commentText, setCommentText] = useState('');
    const {user: loggedInUser} = useAuth();
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

    const cardId = card?._id;

    // ── Paginated comments (newest-first) via GET /cards/:id/comments ───────────
    const fetcher = useCallback(
        (cursor) => getCardComments(cardId, cursor, 10).then(r => ({ items: r.items ?? [], nextCursor: r.nextCursor ?? null })),
        [cardId]
    );
    const { items: comments, setItems, hasMore, loading, loadingMore, error, refresh, loadMore } = useCursorPagination(fetcher);

    useEffect(() => { if (cardId) refresh(); }, [cardId, refresh]);

    // ── Reconcile the loaded window with the authoritative card.comments ────────
    // Optimistic mutations (add / like / reply / delete) flow through the provider
    // and update card.comments. We mirror those into the paginated `comments`
    // WITHOUT pulling the un-loaded older backlog: existing items are refreshed (or
    // dropped if deleted), and only comments strictly NEWER than what we've already
    // loaded (i.e. brand-new additions) are prepended. `newestSeen` is the ceiling
    // of what we've accepted; `didInit` gates reconciliation until the first page
    // has loaded so we never mistake the initial backlog for "new" comments.
    const newestSeen = useRef('');
    const didInit = useRef(false);

    useEffect(() => {
        if (!didInit.current && !loading) {
            didInit.current = true;
            newestSeen.current = comments[0]?.createdAt || '';
        }
    }, [loading, comments]);

    useEffect(() => {
        if (!didInit.current) return;
        const authoritative = card?.comments || [];
        const byId = new Map(authoritative.map(c => [String(c._id), c]));
        setItems(prev => {
            const kept = prev
                .filter(c => byId.has(String(c._id)))       // drop deleted
                .map(c => byId.get(String(c._id)));          // refresh likes/replies
            const prevIds = new Set(prev.map(c => String(c._id)));
            const ceiling = prev[0]?.createdAt || newestSeen.current;
            const added = authoritative
                .filter(c => !prevIds.has(String(c._id)) && String(c.createdAt) > String(ceiling))
                .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
            if (added.length) newestSeen.current = added[0].createdAt;
            return added.length ? [...added, ...kept] : kept;
        });
    }, [card?.comments, setItems]);

    // ── Deep-link: page until the highlighted comment is loaded, then scroll ────
    useEffect(() => {
        if (!highlightCommentId) return;
        const present = comments.some(c => String(c._id) === String(highlightCommentId));
        if (!present) {
            // Not in the loaded window yet — pull the next page (repeats via this
            // effect as `comments` grows) until found or the list is exhausted.
            if (hasMore && !loadingMore && !loading) loadMore();
            return;
        }
        setHighlightedId(highlightCommentId);
        const scrollTimer = setTimeout(() => {
            const el = commentRefs.current.get(highlightCommentId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
        const fadeTimer = setTimeout(() => setHighlightedId(null), 2200);
        return () => { clearTimeout(scrollTimer); clearTimeout(fadeTimer); };
    }, [highlightCommentId, comments, hasMore, loadingMore, loading, loadMore]);

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
            <InfiniteScroll
                loading={loading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                error={!!error}
                isEmpty={!loading && comments.length === 0}
                onLoadMore={loadMore}
                onRetry={refresh}
                root={scrollRoot}
                showEnd={false}
                emptyState={
                    <Typography fontSize={12} color='text.secondary' sx={{ py: 1 }}>
                        There's no comments yet
                    </Typography>
                }
            >
            {comments.map((comment) => {
                const userComment = comment.author;
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
                                        {getFollowersCount(userComment)} followers · {getTimeAgo(comment.createdAt)}
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
                                            onClick={() => toggleCommentLike(card, comment._id)}
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
                                        await toggleFollow(userComment)
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
                                    const replyUser = reply.author;
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
            </InfiniteScroll>
        </Box>

    </Box>
  )
}
