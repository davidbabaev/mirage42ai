import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { getAllCards, createCard, deleteCard, updateCard, likeUnlikeCard, addComment, removeComment, likeUnlikeComment, addReply, getFeedCards, banCard} from '../services/apiService';
import { useCursorPagination } from '../hooks/useCursorPagination';
import { useAuth } from './AuthProvider';

const CardsContext = createContext();

export function CardsProvider({children}) {

    // state for saving cards (register cards)
const [registeredCards, setRegisteredCards] = useState([]);

const {isLoggedIn, user} = useAuth();

// Cursor-paginated feed. The hook owns the accumulated `items` (exposed as
// feedCards) plus loading/hasMore state; refresh() reloads from the top and
// loadMore() appends the next page. In-place edits (like/comment/follow) still
// go through setFeedCards, so the existing handlers below are unchanged.
const feedFetcher = useCallback(
    (cursor) => getFeedCards(cursor).then(r => ({ items: r.cards ?? [], nextCursor: r.nextCursor ?? null })),
    []
);
const {
    items: feedCards,
    setItems: setFeedCards,
    hasMore: feedHasMore,
    loading: feedLoading,
    loadingMore: feedLoadingMore,
    error: feedError,
    refresh: refreshFeedPages,
    loadMore: loadMoreFeed,
    reset: resetFeed,
} = useCursorPagination(feedFetcher);

const fetchCards = async () => {
    // Cards are only shown to signed-in users now (the public pages are walled),
    // so skip the request while logged out instead of firing a wasted GET /cards.
    const token = localStorage.getItem('auth-token')
    if(!token) return;
    try{
        const response = await getAllCards();
        setRegisteredCards(response);
    }
    catch(err){
        console.log(err.message);
    }
}

// Reload the feed from the first page. Kept as `refreshFeed` because several
// screens call it after a mutation (post/delete/ban/edit). Guards on token so a
// logged-out call is a no-op.
const refreshFeed = useCallback(async () => {
    const token = localStorage.getItem('auth-token')
    if(!token) return;
    await refreshFeedPages();
}, [refreshFeedPages]);

// Fetch cards + feed once authenticated, and re-fetch on login. On logout,
// drop the previous user's data so it isn't left sitting in state.
useEffect(() => {
    if(isLoggedIn){
        fetchCards();
        refreshFeed();
    } else {
        setRegisteredCards([]);
        resetFeed();
    }
}, [isLoggedIn]);

// Drop an author's posts from the feed in place (e.g. on unfollow), so they
// disappear instantly without a refetch or scroll reset.
const removeAuthorFromFeed = (userId) => {
    if(!userId) return;
    setFeedCards(prev => prev.filter(card => String(card.userId) !== String(userId)));
}

// Add a newly-followed author's posts to the feed in place. Their cards are
// already loaded client-side in `registeredCards` (GET /cards returns
// active cards), so we merge them in — deduped and date-sorted to match
// the feed's order — without a refetch or scroll reset.
const addAuthorToFeed = (userId) => {
    if(!userId) return;
    setFeedCards(prev => {
        const present = new Set(prev.map(c => c._id));
        const additions = registeredCards.filter(c =>
            String(c.userId) === String(userId) && c.status === 'active' && !present.has(c._id)
        );
        if(additions.length === 0) return prev;
        return [...prev, ...additions].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
    });
}

const handleCardRegister = async (cardData) => {
    try{
        const response = await createCard(cardData);
        setRegisteredCards(prev => [...prev, response]);

        return{
            success: true,
            message: 'Card registered successfully'
        }
    }
    catch(err){
        return{
            success: false,
            message: err.message
        }
    }
}

    const handleDeleteCard = async (cardId) => {
        try{
            await deleteCard(cardId);
            setRegisteredCards(registeredCards.filter(card => card._id !== cardId))

            return{
                success: true,
                message: 'Deleted Successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

        const handleEditCard = async (cardId, cardData) => {
            try{
                const response = await updateCard(cardId, cardData);
                setRegisteredCards(prev => prev.map((card) => {
                    return card._id === cardId ? response : card
                }));

                return{
                    success: true,
                    message: "Edited Successfully"
                }
            }
            catch(err){
                return{
                    success: false,
                    message: err.message
                }
            }
        }

    // Optimistic like: flip my id in the card's likes array in both state arrays
    // IMMEDIATELY (no network wait — kills the "like jank"), fire the request,
    // reconcile with the authoritative card on success, and revert on error.
    // Applying the same pure toggle twice is identity, so it doubles as rollback.
    const handleToggleLike = async (cardId) => {
        const uid = user?._id;
        if (!uid) return { success: false, message: 'Not logged in' };

        const toggle = (card) => {
            if (card._id !== cardId) return card;
            const likes = card.likes || [];
            const liked = likes.some(id => String(id) === String(uid));
            return {
                ...card,
                likes: liked ? likes.filter(id => String(id) !== String(uid)) : [...likes, uid],
            };
        };
        setRegisteredCards(prev => prev.map(toggle));
        setFeedCards(prev => prev.map(toggle));

        try{
            const response = await likeUnlikeCard(cardId);
            setRegisteredCards(prev => prev.map(card => card._id === cardId ? response : card))
            setFeedCards(prev => prev.map(card => card._id === cardId ? response : card))
            return{
                success: true,
                message: 'liked Successfully'
            }
        }
        catch(err){
            // revert the optimistic flip
            setRegisteredCards(prev => prev.map(toggle))
            setFeedCards(prev => prev.map(toggle))
            return{
                success: false,
                message: err.message,
            }
        }
    }

    const handleAddComment = async (cardId, commentText) => {
        try{   
            const response = await addComment(cardId, {commentText})
            setRegisteredCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card
            }))

            setFeedCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card
            }))
            return{
                success: true,
                message: "Comment added successfully"
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

    // Optimistic comment-like: flip my id in the target comment's (or reply's)
    // likes array within the card's embedded comments, instantly, then fire the
    // request and reconcile on success / revert on error. CardsComments'
    // reconcile effect syncs the visible paginated list from card.comments, so
    // the heart flips at once. commentId can be a top-level comment or a reply.
    const handleToggleCommentLike = async (cardId, commentId) => {
        const uid = user?._id;
        if (!uid) return { success: false, message: 'Not logged in' };

        const flip = (likes = []) => {
            const liked = likes.some(id => String(id) === String(uid));
            return liked ? likes.filter(id => String(id) !== String(uid)) : [...likes, uid];
        };
        const toggle = (card) => {
            if (card._id !== cardId) return card;
            const comments = (card.comments || []).map(c => {
                if (String(c._id) === String(commentId)) return { ...c, likes: flip(c.likes) };
                if ((c.replies || []).some(r => String(r._id) === String(commentId))) {
                    return {
                        ...c,
                        replies: c.replies.map(r =>
                            String(r._id) === String(commentId) ? { ...r, likes: flip(r.likes) } : r),
                    };
                }
                return c;
            });
            return { ...card, comments };
        };
        setRegisteredCards(prev => prev.map(toggle));
        setFeedCards(prev => prev.map(toggle));

        try{
            const response = await likeUnlikeComment(cardId, commentId);
            setRegisteredCards(prev => prev.map(card => card._id === cardId ? response : card))
            setFeedCards(prev => prev.map(card => card._id === cardId ? response : card))
            return{
                success: true,
                message: 'Comment like toggled'
            }
        }
        catch(err){
            setRegisteredCards(prev => prev.map(toggle))
            setFeedCards(prev => prev.map(toggle))
            return{
                success: false,
                message: err.message,
            }
        }
    }

    // Add a reply to a comment. Same await-then-replace-card pattern as
    // handleAddComment: the server returns the full updated card (with the
    // new reply nested under its comment), which we swap into both state arrays.
    const handleAddReply = async (cardId, commentId, replyText) => {
        try{
            const response = await addReply(cardId, commentId, {replyText});
            setRegisteredCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card
            }))

            setFeedCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card
            }))

            return{
                success: true,
                message: 'Reply added successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message,
            }
        }
    }

    const handleRemoveComment = async (cardId, commentId) => {
        try{
            const response = await removeComment(cardId, commentId)
            setRegisteredCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card
            }))

            setFeedCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card
            }))

            return{
                success: true,
                message: 'Card removed successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

    const handleBanCard = async (cardId) => {
        try{
            const response = await banCard(cardId)
            setRegisteredCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card 
            }));

            return{
                success: true,
                message: 'Card banned successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }
    
  return (
    <CardsContext.Provider value={{
        registeredCards, 
        handleCardRegister, 
        handleDeleteCard, 
        handleEditCard, 
        handleToggleLike, 
        handleAddComment,
        handleRemoveComment,
        handleToggleCommentLike,
        handleAddReply,
        refreshFeed,
        loadMoreFeed,
        feedHasMore,
        feedLoading,
        feedLoadingMore,
        feedError,
        removeAuthorFromFeed,
        addAuthorToFeed,
        feedCards,
        fetchCards,
        handleBanCard,
    }}>
        {children}
    </CardsContext.Provider>
  )
}

export function useCardsProvider(){
    return useContext(CardsContext);
}
