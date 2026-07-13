import { useParams } from 'react-router-dom'
import { useCardsProvider } from '../providers/CardsProvider';

import { useAuth } from '../providers/AuthProvider';
import useFavoriteCards from '../hooks/useFavoriteCards';
import CardsComments from '../components/CardsComments';
import { getCard } from '../services/apiService';

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import useLikedCards from '../hooks/useLikedCards';
import LoginPopup from '../components/LoginPopup';
import useCommentsCards from '../hooks/useCommentsCards';
import getTimeAgo from '../utils/getTimeAgo';
import MediaDisplay from '../components/MediaDisplay';
import OnLoadingSkeletonBox from '../components/OnLoadingSkeletonBox';

export default function CardDetailsPage() {

    const {id} = useParams();
    const {registeredCards, feedCards} = useCardsProvider()
    const {favoriteCards, handleFavoriteCards} = useFavoriteCards();
    const {user} = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    function onClose(){
        setIsOpen(false)
    }
    const {addComment, countComments, removeComment} = useCommentsCards();
    const navigate = useNavigate();

    const {toggleLike, isLikeByMe, getLikeCount} = useLikedCards()

    // Prefer a live card from local state so optimistic updates keep working.
    const localCard =
        registeredCards.find((card) => card._id === id) ||
        feedCards.find((card) => card._id === id);

    // Fallback fetch when the card isn't in local state (deep-link / not yet loaded).
    const [fetchedCard, setFetchedCard] = useState(null);
    const [fetchLoading, setFetchLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        if (localCard) {
            setFetchedCard(null);
            setFetchError(null);
            return;
        }
        let cancelled = false;
        setFetchLoading(true);
        setFetchError(null);
        getCard(id)
            .then((card) => { if (!cancelled) setFetchedCard(card); })
            .catch((err) => { if (!cancelled) setFetchError(err.message || 'Not found'); })
            .finally(() => { if (!cancelled) setFetchLoading(false); });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const currentCard = localCard || fetchedCard;

    if (!currentCard) {
        if (fetchError) {
            return <p style={{ padding: 20, color: 'gray' }}>This post could not be loaded.</p>;
        }
        return <OnLoadingSkeletonBox />;
    }

    // Embedded on the card by the server — no global users array to look it up in.
    const creator = currentCard.creator
    
  return (
    <div>
        <div style={{
            border: 'solid black 1px', 
            padding: '20px', 
            borderRadius: '20px', 
            margin: '20px 0px'
            }} key={currentCard._id}>

            <h2>{currentCard.title}</h2>
            <MediaDisplay
                mediaUrl={currentCard.mediaUrl}
                mediaType={currentCard.mediaType}
                style={{width: '500px', borderRadius: '20px'}}
            />
            <p>{currentCard.content}</p>
            <hr />
            <div style={{
                display: 'flex', 
                flexDirection: 'row', 
                gap: '10px'
                }}>
                <img 
                    style={{
                        width: '6%', 
                        height: '6%', 
                        borderRadius: '50%', 
                        marginTop: '4px',
                        cursor: 'pointer'
                    }} 
                        src={creator?.profilePicture || 'https://cdn.pixabay.com/profilePicture/2023/02/18/11/00/icon-7797704_640.png'}
                    onClick={() => navigate(`/profiledashboard/${creator._id}/profilemain`)}    
                />
                <p>
                    <span
                        style={{cursor: 'pointer'}}
                        onClick={() => navigate(`/profiledashboard/${creator._id}/profilemain`)}
                    >
                        {creator?.name} {creator?.lastName}
                    </span>
                </p>
                <p>|</p>
                <p
                style={{
                    color: 'gray', 
                    fontSize:'13px', 
                }}
                >{getTimeAgo(currentCard.createdAt)}</p>
                <p>|</p>
                {!currentCard.category ? (<p>Category: Don't Have Yet</p>) : (<p>Category: {currentCard.category}</p>)}
                <p>|</p>
                <p>{getLikeCount(currentCard)} likes</p>
                <p>|</p>
                <p>{countComments(currentCard)} comments</p>
                <p>|</p>

                <div>
                    {user ? (
                        <button onClick={() => toggleLike(currentCard)}>
                            {isLikeByMe(currentCard) ? "Unlike" : "Like"}
                        </button>
                    ):(
                        <button onClick={() => setIsOpen(true)}>Like</button>
                    )}

                    {user ? (
                        <div>
                            {favoriteCards.some(c => c._id === currentCard._id) ? (
                                <button onClick={() => handleFavoriteCards(currentCard)}>Remove From Favorite</button>
                            ) : (
                                <button onClick={() => handleFavoriteCards(currentCard)}>Add To Favorites</button>
                            )}
                        </div>
                        ) : (
                            <button onClick={() => setIsOpen(true)}>Add to favorites</button>
                    )}
                </div>
            </div>
            <div>
                { currentCard._id && (  
                    <CardsComments
                        card = {currentCard}
                        addComment={addComment}
                        removeComment = {removeComment}
                    />
                )}
            </div>

            {  isOpen && (
                <LoginPopup
                    onClose = {onClose}
                />
            )}
                
        </div>

    </div>
  )
}
