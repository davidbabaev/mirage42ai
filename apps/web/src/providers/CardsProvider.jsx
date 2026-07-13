import React, { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { getAllCards, createCard, deleteCard, updateCard, likeUnlikeCard, addComment, removeComment, likeUnlikeComment, addReply, getFeedCards, getExploreCards, banCard} from '../services/apiService';
import { useCursorPagination } from '../hooks/useCursorPagination';
import { useAuth } from './AuthProvider';

const CardsContext = createContext();

export function CardsProvider({children}) {

    // state for saving cards (register cards)
const [registeredCards, setRegisteredCards] = useState([]);

const {isLoggedIn, user, refreshMe} = useAuth();

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

// ── The mutation overlay ────────────────────────────────────────────────────
// `registeredCards` is the overlay that carries mutation state (optimistic likes,
// added comments) so a change reflects on EVERY surface, not just the one you
// clicked on. It no longer holds "all cards in the app" — once the global
// getAllCards load is retired it starts EMPTY and fills only with cards you have
// actually touched.
//
// That makes a plain `.map()` the wrong tool: mapping over a list that doesn't
// contain the card is a SILENT no-op, so the mutation would just vanish. Every
// write into the overlay upserts instead — update in place if present, append if
// not. (The FEED keeps a plain .map: a card you liked on your profile must not be
// injected into your feed just because you touched it.)
const upsertCard = (list, card) => {
    if (!card?._id) return list;
    const i = list.findIndex(c => c._id === card._id);
    if (i === -1) return [...list, card];
    const next = [...list];
    next[i] = card;
    return next;
};

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

// Add a newly-followed author's posts to the feed in place, so they appear
// without a refetch or scroll reset. Their cards used to be sitting in
// `registeredCards` (which held every card in the app) and were simply spliced
// out of it; now we fetch the author's first page from the server instead.
//
// Only the first page: the feed is cursor-paginated by recency, and scrolling on
// will pull the rest of their posts in order anyway. Merged deduped + date-sorted
// to match the feed's ordering.
const addAuthorToFeed = async (userId) => {
    if(!userId) return;
    try{
        const { items = [] } = await getExploreCards(undefined, 10, userId);
        if(!items.length) return;
        setFeedCards(prev => {
            const present = new Set(prev.map(c => c._id));
            const additions = items.filter(c =>
                c.status === 'active' && !present.has(c._id)
            );
            if(additions.length === 0) return prev;
            return [...prev, ...additions].sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
        });
    }
    catch(err){
        // A follow that can't merge posts is not a failed follow — the next feed
        // refresh will pick them up.
        console.log(err.message);
    }
}

const handleCardRegister = async (cardData) => {
    try{
        const response = await createCard(cardData);
        setRegisteredCards(prev => upsertCard(prev, response));
        // My own postsCount comes from the server now (it used to be derived from
        // the global all-cards array), so it has to be re-pulled when I post.
        refreshMe?.();

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
            setRegisteredCards(prev => prev.filter(card => card._id !== cardId))
            refreshMe?.(); // my postsCount just went down

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
                setRegisteredCards(prev => upsertCard(prev, response));

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

    // Optimistic like: flip my id in the card's likes array IMMEDIATELY (no network
    // wait — kills the "like jank"), fire the request, reconcile with the
    // authoritative card on success, and revert on error. Applying the same pure
    // toggle twice is identity, so it doubles as rollback.
    //
    // Takes the CARD OBJECT, not an id: the optimistic flip happens before the
    // server responds, so when the card isn't in the overlay yet this is the only
    // thing we have to seed it from.
    const handleToggleLike = async (card) => {
        const uid = user?._id;
        if (!uid) return { success: false, message: 'Not logged in' };
        if (!card?._id) return { success: false, message: 'Card not found' };
        const cardId = card._id;

        const toggle = (c) => {
            if (c._id !== cardId) return c;
            const likes = c.likes || [];
            const liked = likes.some(id => String(id) === String(uid));
            return {
                ...c,
                likes: liked ? likes.filter(id => String(id) !== String(uid)) : [...likes, uid],
            };
        };
        // Overlay: upsert, so the flip survives even when this card was never loaded
        // into it. Feed: map only — don't inject a card the feed doesn't hold.
        setRegisteredCards(prev => upsertCard(prev, toggle(prev.find(c => c._id === cardId) ?? card)));
        setFeedCards(prev => prev.map(toggle));

        try{
            const response = await likeUnlikeCard(cardId);
            setRegisteredCards(prev => upsertCard(prev, response))
            setFeedCards(prev => prev.map(c => c._id === cardId ? response : c))
            return{
                success: true,
                message: 'liked Successfully'
            }
        }
        catch(err){
            // revert the optimistic flip (toggle is its own inverse)
            setRegisteredCards(prev => upsertCard(prev, toggle(prev.find(c => c._id === cardId) ?? card)))
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
            setRegisteredCards(prev => upsertCard(prev, response))

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
    // Takes the CARD OBJECT for the same reason handleToggleLike does — the
    // optimistic flip lands before the server responds.
    const handleToggleCommentLike = async (card, commentId) => {
        const uid = user?._id;
        if (!uid) return { success: false, message: 'Not logged in' };
        if (!card?._id) return { success: false, message: 'Card not found' };
        const cardId = card._id;

        const flip = (likes = []) => {
            const liked = likes.some(id => String(id) === String(uid));
            return liked ? likes.filter(id => String(id) !== String(uid)) : [...likes, uid];
        };
        const toggle = (c) => {
            if (c._id !== cardId) return c;
            const comments = (c.comments || []).map(cm => {
                if (String(cm._id) === String(commentId)) return { ...cm, likes: flip(cm.likes) };
                if ((cm.replies || []).some(r => String(r._id) === String(commentId))) {
                    return {
                        ...cm,
                        replies: cm.replies.map(r =>
                            String(r._id) === String(commentId) ? { ...r, likes: flip(r.likes) } : r),
                    };
                }
                return cm;
            });
            return { ...c, comments };
        };
        setRegisteredCards(prev => upsertCard(prev, toggle(prev.find(c => c._id === cardId) ?? card)));
        setFeedCards(prev => prev.map(toggle));

        try{
            const response = await likeUnlikeComment(cardId, commentId);
            setRegisteredCards(prev => upsertCard(prev, response))
            setFeedCards(prev => prev.map(c => c._id === cardId ? response : c))
            return{
                success: true,
                message: 'Comment like toggled'
            }
        }
        catch(err){
            setRegisteredCards(prev => upsertCard(prev, toggle(prev.find(c => c._id === cardId) ?? card)))
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
            setRegisteredCards(prev => upsertCard(prev, response))

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
            setRegisteredCards(prev => upsertCard(prev, response))

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
            setRegisteredCards(prev => upsertCard(prev, response));

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
