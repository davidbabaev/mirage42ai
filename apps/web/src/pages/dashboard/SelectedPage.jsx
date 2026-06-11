import React from 'react'
import { useNavigate } from 'react-router-dom';
import useSelectedUsers from '../../hooks/useSelectedUsers';
import { Avatar, Box, Button, Container, Grid, IconButton, Paper, Typography } from '@mui/material';
import { useCardsProvider } from '../../providers/CardsProvider';
import UserReusableCard from '../../components/UserReusableCard';



export default function SelectedPage() {

    const {selectedUsers, handleRemoveUser} = useSelectedUsers()
    const {registeredCards} = useCardsProvider();

  return (
    <Container 
        maxWidth='lg' 
        sx={{
            display: 'grid', 
            gridTemplateColumns: {xs: 'repeat(1, 1fr)', md:'repeat(3, 1fr)'},
            py: 3, 
            gap: 2,
            py: 3, 
            gap: 2,
        }}
    >
        {!selectedUsers[0] && (<Typography color='text.secondary'>You didn't selected users yet</Typography>)}

        {selectedUsers.map((selected) => {
            const myCardsCount = registeredCards.filter(card => card.userId === selected?._id).length;

            return(
                <UserReusableCard
                    key={selected._id}
                    userObject={selected}
                    postsCount={myCardsCount}
                    onRemove={() => handleRemoveUser(selected)}
                />
            )
        })}
    </Container>
)
}
