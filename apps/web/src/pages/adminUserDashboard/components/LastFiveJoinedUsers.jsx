import React, { useState } from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../providers/AuthProvider';
import { useCardsProvider } from '../../../providers/CardsProvider';
import useFollowUser from '../../../hooks/useFollowUser';
import { Avatar, Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import getTimeAgo from '../../../utils/getTimeAgo';
import PersonAddIcon from '@mui/icons-material/PersonAdd';


export default function LastFiveJoinedUsers() {

    const {
        lastFiveUsers
    } = useAnalytics();
    

    const navigate = useNavigate();

    const {user: loggedInUser} = useAuth();
    const [isLoading, setIsLoading] = useState(false)
    const {refreshFeed} = useCardsProvider();
    const {toggleFollow, isFollowByMe, getFollowingCount, getFollowersCount} = useFollowUser();

  return (
    <Box
        sx={{
            display: 'flex', 
            flexDirection: 'column',
            border: '1px solid',
            borderRadius: 3,
            borderColor: 'divider',
            p: 2,
            bgcolor: 'background.paper',
            width: '100%',
        }}
    >

        <Typography fontWeight={700} fontSize={15}>Last 5 joined users</Typography>
        {lastFiveUsers.map((userF) => {
            return(
                <Box 
                    key={userF?._id}
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        py:2,
                    }}>
                        {/* left avatar + info */}
                        <Box sx={{display: 'flex', gap: 1.5, alignItems: 'center'}}>
                            <Avatar
                                src={userF?.profilePicture}
                                sx={{cursor: 'pointer', width: 36, height: 36}}
                                onClick={() => navigate(`/profiledashboard/${userF?._id}/profilemain`)}
                            />
        
                            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
                                <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                                    {userF?.name} {userF?.lastName}
                                    <Typography 
                                        component='span' 
                                        color='text.secondary'
                                        fontSize={11}
                                        fontWeight={400}
                                    >
                                        {isFollowByMe(userF?._id) && ' · following'}
                                    </Typography>
                                </Typography>
        
                                <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                    {userF?.job}
                                </Typography>
        
                                <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                    {getFollowersCount(userF?._id)} followers · Joined {getTimeAgo(userF?.createdAt)} 
                                </Typography>
        
                            </Box>
                        </Box>
        
        
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        {/* Right: Follow button */}

                        {loggedInUser && loggedInUser._id !== userF?._id && !isFollowByMe(userF?._id) &&(
                            <Button
                                size='small'
                                variant={'outlined'}
                                startIcon={<PersonAddIcon/>}
                                onClick={async () => {
                                    await toggleFollow(userF?._id)
                                    await refreshFeed();
                                }}
                                sx={{fontSize: 9, minWidth: 70, borderRadius: 5, py: 0.3,
                                    '& .MuiButton-startIcon' : {mb: 0.2}, lineHeight: 0 
                                }}
                            >
                                Follow
                            </Button>
                        )}

                    </Box>
                </Box>
            )
        })}
    </Box>
  )
}
        // <div key={userF._id}>
        //     <span 
        //         style={{
        //             display:'flex', 
        //             gap: '10px', 
        //             marginBottom: '15px', 
        //             borderBottom: '1px solid lightgray', 
        //             cursor: 'pointer'
        //         }} 
        //         onClick={() => navigate(`/profiledashboard/${userF._id}/profilemain`)}>
        //         <img 
        //         style={{
        //             width: '40px',
        //             height: '40px',
        //             borderRadius: '50%',
        //             border: '2px, solid, white',
        //             objectFit: 'cover',
        //         }} 
        //             src={userF.profilePicture}
        //         />
        //         <p>{userF.name} {userF.lastName} -</p>
        //         <p>Joined At {userF.createdAt.split("T")[0]}</p>
        //     </span>
        // </div>
