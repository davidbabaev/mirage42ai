import React from 'react'
import TopAndLastFiveCardReuse from './reusable components/TopAndLastFiveCardReuse'
import useAnalytics from '../hooks/useAnalytics'
import { Box, Divider, Typography } from '@mui/material';
import { useUsersProvider } from '../../../providers/UsersProvider';

export default function TopAndLastFiveCards() {

    const {
        topFiveCards,
        lastFiveCards,
    } = useAnalytics();
    const {users} = useUsersProvider();

  return (
    <Box sx={{display: 'flex', flexDirection: {xs: 'column', md: 'row'} ,gap: 2}}>
        <Box
            sx={{
                flex: 1,
                border: '1px solid',
                borderRadius: 3,
                p:3,
                borderColor: 'divider',
                bgcolor: 'background.paper'
            }}
        >
            <Typography fontWeight={700} fontSize={23}>Top 5 Posts</Typography>
            <Typography fontSize={14} color='text.secondary'>
                The most recently published posts across the platform.
            </Typography>
            <TopAndLastFiveCardReuse
                topFiveValue = {topFiveCards}
                usersArrayValue = {users}
                mainTitle = {"Top 5 cards"}
                showInteractions = {true}
                />
        </Box>

        <Box sx={{
            flex: 1,
            border: '1px solid',
            borderRadius: 3,
            p:3,
            borderColor: 'divider',
            bgcolor: 'background.paper'
        }}>
            <Typography fontWeight={700} fontSize={23}>Last 5 Posts</Typography>
            <Typography fontSize={14} color='text.secondary'>
                The highest-performing posts on the platform, ranked by total engagement (likes + comments).
            </Typography>
            <TopAndLastFiveCardReuse
                topFiveValue = {lastFiveCards}
                usersArrayValue = {users}
                mainTitle = {"Last 5 created posts"}
                showInteractions = {false}
            />
        </Box>
    </Box>
  )
}
