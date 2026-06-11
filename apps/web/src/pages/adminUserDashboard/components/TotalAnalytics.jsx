import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import StatCardReuse from './reusable components/StatCardReuse';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import { Box } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import GroupIcon from '@mui/icons-material/Group';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import LoggedInThirtyDays from './LoggedInThirtyDays';

export default function TotalAnalytics() {

    const {
      commentsCount, 
      likesCount, 
      usersLength, 
      registeredCardsLength, 
      avgEngagement
    } = useAnalytics();

  return (
    <Box sx={{
      display: 'grid ', 
      gridTemplateColumns: {xs: 'repeat(2, 1fr)',md:'repeat(2, 1fr)'},
      gap: 2
    }}>
        <StatCardReuse 
          value={commentsCount} 
          label="Total Comments"
          icon={<ChatBubbleIcon/>}
          color={"#7F77DD"}
        />
        <StatCardReuse 
          value={likesCount} 
          label="Total Likes"
          icon={<ThumbUpIcon/>}
          color={"#7F77DD"}
        />
        <StatCardReuse 
          value={usersLength} 
          label="Total Users"
          icon={<GroupIcon/>}
          color={"#7F77DD"}
        />
        <StatCardReuse 
          value={registeredCardsLength} 
          label="Total Posts"
          icon={<ArticleIcon/>}
          color={"#7F77DD"}
        />
        <StatCardReuse 
          value={avgEngagement} 
          label="Posts Avg. Engagement"
          icon={<InsertEmoticonIcon/>}
          color={"#7F77DD"}
        />

        {/* <LoggedInThirtyDays/> */}
    </Box>
  )
}
