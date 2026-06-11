import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { Box, Chip, Divider, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

export default function RetentionUserRegisterLoginLastTwoWeeks() {

    const {
        retention,
        weeklyActiveUsersCount,
        newRegisteredUsers_LastWeek_count,
    } = useAnalytics();

  return (
        <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p:3,
            gap: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            minWidth: {xs: '100%', md:300},
            minHeight: 250,
            bgcolor: 'background.paper'
        }}
    >
        <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
            <Typography fontSize={13} color="text.secondary">Retention Rate</Typography>
            {retention >= 0 ? (
                <TrendingUpIcon sx={{fontSize: 35, color: 'success.main'}}/>
            ):(
                <TrendingDownIcon sx={{fontSize: 35, color: 'error.main'}}/>
            )}
        </Box>

        <Typography fontSize={28} fontWeight={700}>{retention}%</Typography>

        <Typography fontSize={15} color='text.secondary'>
            {newRegisteredUsers_LastWeek_count}{' '}
            registered last week 
        </Typography>

        <Typography fontSize={15} color='text.secondary'>
            {weeklyActiveUsersCount}{' '}
            logged in this week 
        </Typography>
        
        <Divider/>

        

            <Chip
                label={`${retention}% returned`}
                size='small'
                sx={{
                    bgcolor: retention >= 50 ? 'success.main' : 'error.main',
                    color: 'white' ,
                    fontWeight: 600,
                    fontSize: 12,
                    width: 'fit-content'
                }}
            />

    </Box>
  )
}

