import React from 'react'
import useSelectedUsers from '../../hooks/useSelectedUsers';
import { Avatar, Box, Button, Container, Grid, IconButton, Paper, Typography } from '@mui/material';
import UserReusableCard from '../../components/UserReusableCard';



export default function SelectedPage() {

    const {selectedUsers, handleRemoveUser} = useSelectedUsers()

  return (
    <Container 
        maxWidth='lg' 
        sx={{
            display: 'grid',
            gridTemplateColumns: {xs: 'repeat(1, 1fr)', md:'repeat(3, 1fr)'},
            py: 3,
            gap: 2,
        }}
    >
        {!selectedUsers[0] && (<Typography color='text.secondary'>You didn't selected users yet</Typography>)}

        {selectedUsers.map((selected) => {
            const myCardsCount = selected?.postsCount ?? 0;

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
