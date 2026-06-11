import React from 'react'
import { useParams } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';

export default function UserProfileAbout() {

  const {users} = useUsersProvider();
  const {id} = useParams();

  const userProfile = users.find((user) => user._id === id);

  if(!userProfile) {
    return <OnLoadingSkeletonBox/>
  }

    const userData = [
        {label: 'Email' , value: userProfile.email},
        {label: 'Phone' , value: userProfile.phone},
        {label: 'Country' , value: userProfile.address?.country},
        {label: 'City' , value: userProfile.address?.city},
        {label: 'Age' , value: userProfile.age},
        {label: 'Job' , value: userProfile.job},
        {label: 'Gender' , value: userProfile.gender},
        {label: 'Birth Date' , value: userProfile.birthDate?.split("T")[0]},
        {label: 'Joined to Mirage' , value: userProfile.createdAt?.split("T")[0]},
    ]

  return (
      <Box
          sx={{
              display: 'flex',
              flexDirection: 'column',
              mb: 2
          }}
          >
              <Paper
                  elevation={0}
                  sx={{
                      mt: 2,
                      p: 3,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider'
                  }}
              >
                  <Typography fontSize={20} fontWeight={700} pb={1}>
                      About            
                  </Typography>
                  <Typography fontSize={15} sx={{lineHeight: 1.2, whiteSpace: 'pre-wrap'}}>
                      {userProfile.aboutMe}            
                  </Typography>
              </Paper>

              <Paper
                  elevation={0}
                  sx={{
                      mt: 2,
                      p: 3,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      flexWrap: 'wrap',
                  }}
              >
                  {userData.map((data, index) => (
                      <Box key={index} sx={{display: 'flex', width: '50%',}}>
                          <Box sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              py: 1,
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              width: '100%',
                          }}>
                              <Typography fontSize={14} color='text.secondary'>
                                  {data.label}            
                              </Typography>
                              <Typography fontSize={15} fontWeight={700}>
                                  {data.value}
                              </Typography>
                          </Box>
                      </Box>
                  ))}
              </Paper>
      </Box>

  )
}