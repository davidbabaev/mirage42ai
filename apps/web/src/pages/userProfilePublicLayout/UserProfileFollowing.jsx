import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider';
import useFollowUser from '../../hooks/useFollowUser';
import { useCardsProvider } from '../../providers/CardsProvider';
import { Avatar, Box, Button, Grid, Paper, Typography } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';

export default function UserProfileFollowing() {

  const {id} = useParams();
  const {users} = useUsersProvider();
  const {user} = useAuth();
  const {toggleFollow, isFollowByMe, getFollowersCount} = useFollowUser();
  const navigate = useNavigate();
  const {refreshFeed} = useCardsProvider();
  
  
  const currentUserProfile = users.find((userP) => userP._id === id);

  if(!currentUserProfile){
    return <OnLoadingSkeletonBox/>
  }
  
  const currentUserFollowing = users.filter((userF) => currentUserProfile.following.includes(userF._id));

  return (
    <Paper
      elevation={0}
      sx={{
        my: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
      }}
    >
        <Box sx={{display: 'flex', textAlign: 'center', justifyContent: 'center'}}>
          {currentUserFollowing.length === 0 && (<Typography color='text.secondary'>No following yet</Typography>)}
        </Box>

        <Box sx={{ p: 2, gap: {xs: 2, md: 0},display: 'flex', flexDirection: {xs: 'column',md: 'row'},flexWrap: 'wrap', justifyContent: 'space-between'}}>
          {currentUserFollowing.map((following) => (
              <Box sx={{
                display: 'flex', 
                gap: 1.5, 
                width: {xs: '100%',md:'48%'}, 
                alignItems: 'center', 
                px: {xs: 0 ,md:1},
                pt: {xs: 0 ,md:1},
                pb: 2, 
                borderBottom: '1px solid', 
                borderColor: 'divider', 
                mx:{xs: 0, md:1},
            }}>
                  <Avatar
                      src={following?.profilePicture}
                      sx={{cursor: 'pointer', width: 48, height: 48}}
                      onClick={() => navigate(`/profiledashboard/${following?._id}/profilemain`)}
                  />

                  <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1}}>
                      <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                          {following?.name} {following?.lastName}
                          <Typography 
                              component='span' 
                              color='text.secondary'
                              fontSize={11}
                              fontWeight={400}
                          >
                              {isFollowByMe(following?._id) && ' · following'}
                          </Typography>
                      </Typography>

                      <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                          {following?.job}
                      </Typography>

                      <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                          {getFollowersCount(following?._id)} followers
                      </Typography>
                  </Box>

                  {/* Right: Follow button */}
                  {user && user._id !== following?._id && !isFollowByMe(following?._id) &&(
                      <Button
                          size='small'
                          variant={'outlined'}
                          startIcon={<PersonAddIcon/>}
                          onClick={async () => {
                              await toggleFollow(following?._id)
                              await refreshFeed();
                          }}
                          sx={{
                              fontSize: 9, 
                              borderRadius: 5, 
                              // '& .MuiButton-startIcon' : {mb: 0.2} 
                          }}
                      >
                          Follow
                      </Button>
                  )}
          </Box>
          ))}
      
      </Box>
    </Paper>
  )
}
