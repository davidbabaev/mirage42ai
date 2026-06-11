import useFavoriteCards from '../../hooks/useFavoriteCards';
import { useNavigate } from 'react-router-dom';
import getTimeAgo from '../../utils/getTimeAgo';
import MediaDisplay from '../../components/MediaDisplay';
import React, { useState } from 'react'
import { Avatar, Box, Button, Chip, Typography, useTheme } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import { useUsersProvider } from '../../providers/UsersProvider';


export default function FavoriteCards() {

    const {favoriteCards, handleRemoveCard} = useFavoriteCards();
    const {users} = useUsersProvider()
    const navigate = useNavigate();
    
    const [count, setCount] = useState(5);
    const [isExpanded, setIsExpanded] = useState(null)
    const theme = useTheme();
    const countedRegisterCards = favoriteCards.slice(0, count)  

  return (
    <Box sx={{display: 'flex', justifyContent: 'center', pt: 3, flexDirection: 'column'}}>
        {!countedRegisterCards[0] && (<Typography color='text.secondary'>You didn't selected users yet</Typography>)}

        {countedRegisterCards.map((favCard) => {
            const currentUser = users.find(user => favCard.userId === user._id) 
            if(!currentUser) return;

            return(
                <Box key={favCard._id}>
                    <Box 
                        sx={{
                            display: 'flex',
                            width: '100%', 
                            flexDirection: {xs: 'column', md: 'row'},
                            borderRadius: 3,
                            border: '0.5px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            my: 2,
                            p: 2,
                            gap: 2,
                        }}
                    >
                        <Box sx={{maxWidth: {xs: '100%', md: 250}}}>
                            <MediaDisplay
                                mediaUrl={favCard.mediaUrl}
                                mediaType={favCard.mediaType}
                                style={{
                                    width: '100%',
                                    height: '100%', 
                                    objectFit: 'cover',
                                    borderRadius: 10
                                }}
                            />
                        </Box>

                        <Box flex={1}>

                            {/* Title */}
                            {favCard.title && (
                                <Typography lineHeight={0.8} component='div' fontWeight={600} fontSize={18} mb={1}>
                                    {favCard.title}
                                </Typography>
                            )}


                            <Box sx={{display: 'flex', gap: 1, alignItems: 'center', mb:1}}>

                                <Avatar 
                                    src={currentUser?.profilePicture}
                                    sx={{
                                        width: 30, 
                                        height: 30, 
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => navigate(`/profiledashboard/${currentUser._id}/profilemain`)}
                                />
                                <Typography 
                                    component={'div'} 
                                    fontSize={12} 
                                    color='text.secondary' 
                                    lineHeight={0.9} 
                                    onClick={() => navigate(`/profiledashboard/${currentUser._id}/profilemain`)}
                                    sx={{cursor: 'pointer'}}

                                >
                                    {currentUser?.name} {currentUser?.lastName}
                                </Typography>

                                <Typography component={'div'} fontSize={22} color='text.secondary' lineHeight={0.9}>
                                    ∙
                                </Typography>

                                <Typography component={'div'} fontSize={12} color='text.secondary' lineHeight={0.9}>
                                    {getTimeAgo(favCard.createdAt)}
                                </Typography>

                                {favCard.category && (
                                    <Chip 
                                        label={favCard.category} 
                                        size='small'  
                                    />
                                )}

                            </Box>

                            {/* Contnet */}
                            {favCard.content && (
                                <Typography component='div' fontWeight={400} fontSize={14} mb={1} sx={{whiteSpace: 'pre-wrap'}}>
            
                                    {isExpanded === favCard._id ? favCard.content : favCard.content.slice(0, 150)}
            
                                    {favCard.content.length > 150 && (
                                        <span
                                            onClick={() => setIsExpanded(isExpanded === favCard._id ? null : favCard._id)}
                                            style={{
                                                color: theme.palette.primary.main, 
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                marginLeft: 4
            
                                            }}
                                        >
                                            {isExpanded === favCard._id ? '...showless' : '...read more'}
                                        </span>
                                    )}
            
                                </Typography>
                            )}

                        </Box>

                        <Box sx={{display: 'flex', gap: 1, alignItems: 'start'}}>
                            <Button 
                                variant='outlined'
                                color='error'
                                size='small'
                                sx={{borderRadius: 5, px: 2, py:0.5, fontSize: 10}}
                                endIcon={<DeleteIcon/>}
                                onClick={() => handleRemoveCard(favCard)}
                            >
                                Remove
                            </Button>
                        </Box>
                        
                    </Box>
                </Box>
            )
        })}
        {favoriteCards.length > count &&(
            <Box
                sx={{
                    display: 'flex',
                    width: '100%', 
                    justifyContent: 'center'}}
            >
                <Button 
                    onClick={() => setCount(count + 5)}
                    endIcon={<ExpandCircleDownIcon/>} 
                    variant='outlined'
                    sx={{borderRadius: 5}}
                    >
                        Load More
                </Button>
            </Box>
        )}
    </Box>
  )
}
