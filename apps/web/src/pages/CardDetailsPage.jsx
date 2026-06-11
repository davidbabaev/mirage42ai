import { useParams } from 'react-router-dom'
import { useCardsProvider } from '../providers/CardsProvider';

import { useAuth } from '../providers/AuthProvider';
import useFavoriteCards from '../hooks/useFavoriteCards';
import CardsComments from '../components/CardsComments';

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import useLikedCards from '../hooks/useLikedCards';
import LoginPopup from '../components/LoginPopup';
import useCommentsCards from '../hooks/useCommentsCards';
import getTimeAgo from '../utils/getTimeAgo';
import MediaDisplay from '../components/MediaDisplay';
import OnLoadingSkeletonBox from '../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../providers/UsersProvider';

export default function CardDetailsPage() {

    const {id} = useParams();
    const {registeredCards} = useCardsProvider()
    const {favoriteCards, handleFavoriteCards} = useFavoriteCards();
    const {users} = useUsersProvider();
    const {user} = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    function onClose(){
        setIsOpen(false)
    }
    const {addComment, countComments, removeComment} = useCommentsCards();
    const navigate = useNavigate();

    const {toggleLike, isLikeByMe, getLikeCount} = useLikedCards()

    const currentCard = registeredCards.find((card) => card._id === id);
    
        if(!currentCard){
            return <OnLoadingSkeletonBox/>
        }
    
    const creator = users.find((userC) => userC._id === currentCard.userId)
    
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
                <p>{getLikeCount(currentCard._id)} likes</p>
                <p>|</p>
                <p>{countComments(currentCard._id)} comments</p>
                <p>|</p>

                <div>
                    {user ? (
                        <button onClick={() => toggleLike(currentCard._id)}>
                            {isLikeByMe(currentCard._id) ? "Unlike" : "Like"}
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
                        users={users}
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
