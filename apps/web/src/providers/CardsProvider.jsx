import React, { createContext, useContext, useEffect, useState } from 'react'
import { getAllCards, createCard, deleteCard, updateCard, likeUnlikeCard, addComment, removeComment, getFeedCards, banCard} from '../services/apiService';
import { useAuth } from './AuthProvider';

const CardsContext = createContext();

export function CardsProvider({children}) {

    // state for saving cards (register cards)
const [registeredCards, setRegisteredCards] = useState([]);

const [feedCards, setFeedCards] = useState([]);
const {isLoggedIn} = useAuth();

const fetchCards = async () => {
    try{
        const response = await getAllCards();
        setRegisteredCards(response);
    }
    catch(err){
        console.log(err.message);
    }
}
// useEffect on mount
useEffect(() => {
    fetchCards();
}, [])

// fetches feed on mount (first load)
useEffect(() => {
    const token = localStorage.getItem('auth-token')
    if(token){
        refreshFeed();
    }
}, [isLoggedIn]);

// can be called anytime you need to re-fetch
const refreshFeed = async () => {
    const token = localStorage.getItem('auth-token')
    if(!token) return; //<- guard

    try{
        const response = await getFeedCards();
        setFeedCards(response);
    }
    catch(err){
        console.log(err.message);
    }
}

// Drop an author's posts from the feed in place (e.g. on unfollow), so they
// disappear instantly without a refetch or scroll reset.
const removeAuthorFromFeed = (userId) => {
    if(!userId) return;
    setFeedCards(prev => prev.filter(card => String(card.userId) !== String(userId)));
}

// Add a newly-followed author's posts to the feed in place. Their cards are
// already loaded client-side in `registeredCards` (GET /cards returns all
// non-banned cards), so we merge them in — deduped and date-sorted to match
// the feed's order — without a refetch or scroll reset.
const addAuthorToFeed = (userId) => {
    if(!userId) return;
    setFeedCards(prev => {
        const present = new Set(prev.map(c => c._id));
        const additions = registeredCards.filter(c =>
            String(c.userId) === String(userId) && !c.isBanned && !present.has(c._id)
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

    const handleToggleLike = async (cardId) => {
        try{
            const response = await likeUnlikeCard(cardId);
            setRegisteredCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card
            }))

            setFeedCards(prev => prev.map((card) => {
                return card._id === cardId ? response : card
            }))

            return{
                success: true,
                message: 'liked Successfully'
            }
        }
        catch(err){
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
        refreshFeed,
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
