import React from 'react'
import MostPupularCardReuse from './reusable components/MostPupularCardReuse';
import useAnalytics from '../hooks/useAnalytics';
import { Box } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import GradeIcon from '@mui/icons-material/Grade';

export default function MostPopular() {

    const { 
      mostActiveUser,
      mostLikesCard,
    } = useAnalytics();

  return (
    <Box sx={{
      display: 'flex', 
      flexDirection: {xs:'column', md: 'row'},
      justifyContent: 'start', 
      alignItems: 'start', 
      gap: 2
    }}>
        <MostPupularCardReuse
            valueTitle = {mostActiveUser?.name}
            title = {"Most Active User"}
            valueCount = {mostActiveUser?.posts}
            description = {"Total Posts"}
            icon = {<CampaignIcon/>}
            />    

        <MostPupularCardReuse
            valueTitle = {mostLikesCard?.title}
            title = {"Most like card"}
            valueCount = {mostLikesCard?.likes.length}
            description = {"Post's Likes"}
            icon = {<GradeIcon/>}
        />    
    </Box>
  )
}
