import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider';
import useFollowUser from '../../hooks/useFollowUser';
import { useCardsProvider } from '../../providers/CardsProvider';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Avatar, Box, Button, Paper, Typography } from '@mui/material';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';


export default function UserProfileFollowers() {

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

  const currentUserFollowers = users.filter((userF) => userF.following.includes(currentUserProfile._id));

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
        <Box sx={{display: 'flex', textAlign: 'center',justifyContent: 'center'}}>
          {currentUserFollowers.length === 0 && (<Typography color='text.secondary'>No followers yet</Typography>)}
        </Box>

        <Box 
          sx={{ 
            p: 2, 
            display: 'flex', 
            flexWrap: 'wrap', 
            justifyContent: 'space-between',
            gap: {xs: 2, md: 0},
            flexDirection: {xs: 'column',md: 'row'}
          }}
        >
          {currentUserFollowers.map((follower) => (
              <Box 
                sx={{
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
                      src={follower?.profilePicture}
                      sx={{cursor: 'pointer', width: 48, height: 48}}
                      onClick={() => navigate(`/profiledashboard/${follower?._id}/profilemain`)}
                  />

                  <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1}}>
                      <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                          {follower?.name} {follower?.lastName}
                          <Typography 
                              component='span' 
                              color='text.secondary'
                              fontSize={11}
                              fontWeight={400}
                          >
                              {isFollowByMe(follower?._id) && ' · following'}
                          </Typography>
                      </Typography>

                      <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                          {follower?.job}
                      </Typography>

                      <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                          {getFollowersCount(follower?._id)} followers
                      </Typography>
                  </Box>

                  {/* Right: Follow button */}
                  {user && user._id !== follower?._id && !isFollowByMe(follower?._id) &&(
                      <Button
                          size='small'
                          variant={'outlined'}
                          startIcon={<PersonAddIcon/>}
                          onClick={async () => {
                              await toggleFollow(follower?._id)
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

/* return (
  <div>
    <h2>Followers</h2>
    {currentUserFollowers.length === 0 && (<p>Still Not Have follower</p>)}
    {currentUserFollowers.map((follower) => (
      <div key={follower._id} style={{display:'flex', gap: '10px', marginBottom: '15px'}}>
        <img style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: '2px, solid, white',
            objectFit: 'cover',
            cursor: 'pointer'
        }} src={follower.profilePicture}/>
        <p>
          <span
              style={{cursor: 'pointer'}}
              onClick={() => navigate(`/profiledashboard/${follower._id}/profilemain`)}
          >
            {follower.name} {follower.lastName}
          </span></p>
        {user?._id !== follower._id && (
          <button
            onClick={
              async() => {
                await toggleFollow(follower._id)
                await refreshFeed();
            }}
          >{isFollowByMe(follower._id) ? "Unfollow" : "Follow"}</button>
        )}
      </div>
    ))}
  </div>
) */