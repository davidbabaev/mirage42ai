import { Avatar, Box, Button, IconButton, Paper, Tooltip, Typography } from '@mui/material'
import React, { useState } from 'react'
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckIcon from '@mui/icons-material/Check';
import useSelectedUsers from '../hooks/useSelectedUsers';
import useFollowUser from '../hooks/useFollowUser';
import { useCardsProvider } from '../providers/CardsProvider';
import { useNavigate } from 'react-router-dom';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useAuth } from '../providers/AuthProvider';
import LoginPopup from './LoginPopup';


export default function UserReusableCard({
    userObject, 
    postsCount, 
    onRemove, 
    onSave, 
    isSaved, 
    onRemoveSaved,
}) {

    // const {selectedUsers, handleRemoveUser, selectHandleUser} = useSelectedUsers();
    const{getFollowersCount, toggleFollow, isFollowByMe} = useFollowUser();
    const {refreshFeed} = useCardsProvider();
    const navigate = useNavigate();
    const {user, isLoggedIn} = useAuth();

    const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
    function onCloseLoginPopup(){
        setIsLoginPopupOpen(false)
    }

  return (
    <Paper 
        elevation={0}
        sx={{
            borderRadius: 3,
            border: '0.5px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            textAlign: 'center',
            bgcolor: 'background.paper',
            mb:2,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
        }}
        key={userObject._id}
    >
        <Box sx={{position: 'relative'}}>
            {/* Cover Image */}
            <Box
                sx={{
                    width: '100%',
                    height: 80,
                    backgroundImage: `url(${userObject?.coverImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}       
            />
            {onRemove ? (
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        p:0.5,
                        '&:hover': {bgcolor: 'rgba(0,0,0,0.7)'}
                    }}
                    onClick={onRemove}
                >
                    <CloseIcon fontSize='small'/>
                </IconButton>
            ): (
                <Box sx={{display: userObject._id === user?._id ? 'none' : 'block'}}>
                    {isSaved ? (
                        <Tooltip title="Unsave from favorites">
                        <IconButton
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                bgcolor: 'rgba(0,0,0,0.5)',
                                color: 'white',
                                p:0.5,
                                '&:hover': {bgcolor: 'rgba(0,0,0,0.7)'}
                            }}
                            onClick={onRemoveSaved}
                        >
                            <FavoriteIcon fontSize='small'/>
                        </IconButton>
                    </Tooltip>
                    ) : (
                        <Tooltip title="Save to favorite users">
                          <IconButton 
                              size='small'
                              sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    color: 'white',
                                    p:0.5,
                                    '&:hover': {bgcolor: 'rgba(0,0,0,0.7)'}
                              }}
                              onClick={isLoggedIn ? onSave : () => setIsLoginPopupOpen(true)}
                          >
                              <FavoriteBorderIcon sx={{fontSize: 20}}/>
                          </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )}
        </Box>

        <Box 
            sx={{mt: '-40px', mb:1}} 
            onClick={() => navigate(`/profiledashboard/${userObject?._id}/profilemain`)}
        >
            <Avatar
                src={userObject?.profilePicture}
                sx={{
                    width: 80,
                    height: 80,
                    border: '2px solid',
                    borderColor: 'background.paper',
                    margin: '0 auto',
                    cursor: 'pointer'
                }}
            />
        </Box>
        
        {/* Name, Job, Location */}
        <Box sx={{px:2, pb:2}}>
            <Typography 
                fontWeight={600} 
                fontSize={16}
                onClick={() => navigate(`/profiledashboard/${userObject?._id}/profilemain`)}
                sx={{cursor: 'pointer'}}
            >
                {userObject?.name} {userObject?.lastName}
            </Typography>

            <Typography 
                fontSize={13} 
                color='text.secondaty' 
                sx={{mb: -0.5}}
            >
                {userObject?.job}
            </Typography>

            <Typography fontSize={12} color='text.disabled'>
                {userObject?.address.country}, {userObject?.address.city}
            </Typography>

            <Typography fontSize={14} px={2} pt={1}>
                {userObject?.aboutMe.slice(0, 70) + '...'}
            </Typography>
        </Box>

        {/* Stats row */}
        <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 3,
            px: 2,
            pb: 2,
            borderTop: '0.5px solid',
            borderColor: 'divider',
            pt: 2
        }}>
            <Box 
                textAlign='center'
                onClick={() => navigate(`/profiledashboard/${userObject?._id}/followers`)}
                sx={{cursor: 'pointer'}}
            >
                <Typography 
                    fontWeight={600}
                    fontSize={14}
                >
                    {getFollowersCount(userObject?._id)}
                </Typography>

                <Typography 
                    fontSize={13}
                    color='text.secondary'
                >
                    followers
                </Typography>
            </Box>
            <Box 
                textAlign='center'
                onClick={() => navigate(`/profiledashboard/${userObject?._id}/following`)}
                sx={{cursor: 'pointer'}}
            >
                <Typography 
                    fontWeight={600}
                    fontSize={14}
                >
                    {(userObject?.following || []).length}
                </Typography>

                <Typography 
                    fontSize={13}
                    color='text.secondary'
                >
                    following
                </Typography>
            </Box>

            <Box 
                textAlign='center'
                onClick={() => navigate(`/profiledashboard/${userObject?._id}/profilemain`)}
                sx={{cursor: 'pointer'}}
            >
                <Typography 
                    fontWeight={600}
                    fontSize={14}
                >
                    {postsCount}
                </Typography>

                <Typography 
                    fontSize={13}
                    color='text.secondary'
                >
                    posts
                </Typography>
            </Box>
        </Box>

        <Box px={2}>

            <Button
                size='small'
                variant={isFollowByMe(userObject._id) ? 'outlined' : 'outlined'}
                startIcon={isFollowByMe(userObject._id) ? <CheckIcon/> : <PersonAddIcon/>}
                onClick={async () => {
                    if(!isLoggedIn){
                        setIsLoginPopupOpen(true)
                        return;
                    }
                    await toggleFollow(userObject._id)
                    await refreshFeed()
                    
                }}
                fullWidth
                sx={{
                    fontSize: 9, 
                    borderRadius: 5, 
                    py: 0.3,
                    '& .MuiButton-startIcon' : {mb: 0.2}, 
                    lineHeight: 0,
                    mb:2,
                }}
                color={isFollowByMe(userObject._id) ? 'inherit' : 'primary'}
            >
                {isFollowByMe(userObject._id) ? 'Following' : 'Follow'}
            </Button>
        </Box>

        {isLoginPopupOpen && (
            <LoginPopup
                onCloseLoginPopup={onCloseLoginPopup}
            />
        )}
    </Paper>
  )
}
