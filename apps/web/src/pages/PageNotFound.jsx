import React from 'react'
import ReportIcon from '@mui/icons-material/Report';
import { Box, Button, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { useNavigate } from 'react-router-dom';

export default function PageNotFound() {

    const navigate = useNavigate();

  return (
    <Box
        sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >
        <ReportIcon sx={{fontSize: 100, color: 'primary.main'}}/>
        <Typography fontWeight={700} fontSize={60} lineHeight={1}>404</Typography>
        <Typography fontSize={30} lineHeight={1}>This page not found</Typography>
        <Button 
            variant='outlined' 
            startIcon={<HomeIcon/>} 
            sx={{mt: 2}}
            onClick={() => navigate('/')}    
        >Back to feed</Button>
    </Box>
  )
}
