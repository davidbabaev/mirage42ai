import { Box, Container, Paper } from '@mui/material'
import React, { useState } from 'react'
import { useCardsProvider } from '../../providers/CardsProvider';
import { useParams } from 'react-router-dom';
import CardPopupModal from '../../components/card/CardPopupModal';
import { useAuth } from '../../providers/AuthProvider';
import LoginPopup from '../../components/LoginPopup';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';

export default function UserProfileMedia() {

    const [count, setCount] = useState(10);
    const {users} = useUsersProvider();
    const {registeredCards} = useCardsProvider();
    const {id} = useParams();
    const [selectedCardId, setSelectedCardId] = useState(null);
    const {user, isLoggedIn} = useAuth();

    const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
    function onCloseLoginPopup(){
        setIsLoginPopupOpen(false)
    }

    const userProfile = users.find(u => u._id === id);

    
    if(!userProfile){
        return <OnLoadingSkeletonBox/>
    }

    const userCards = registeredCards.filter(uCard => uCard.userId === userProfile._id).sort((a,b) => b.createdAt.localeCompare(a.createdAt))

    
    const countedRegisterCards = userCards.slice(0, count)    

  return (
    <Box>
        <Paper
            elevation={0}
            sx={{
                display: 'grid',
                gridTemplateColumns: {xs: 'repeat(3,1fr)',md:'repeat(5,1fr)'},
                gap: 1,
                borderRadius: 3,
                p:2,
                my: 2,
            }}
        >
            {countedRegisterCards.map((image) => (
                <Box
                    key={image._id}
                    sx={{
                        aspectRatio: '1',
                        borderRadius: 2,
                        backgroundImage: `url(${image.mediaUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        cursor: 'pointer',
                        '&:hover': {opacity: 0.85}
                    }}
                    onClick = {() => isLoggedIn ? setSelectedCardId(image._id): setIsLoginPopupOpen(true)}
                />
            ))}
            {selectedCardId && (
                <CardPopupModal
                    cardId = {selectedCardId}
                    onClose = {() => setSelectedCardId(null)}
                />
            )}
        </Paper>
        
        {isLoginPopupOpen && (
            <LoginPopup
                onCloseLoginPopup={onCloseLoginPopup}
            />
        )}
    </Box>
  )
}
