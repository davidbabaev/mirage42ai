import { BorderBottom, BorderColor } from '@mui/icons-material'
import { Box, Button, IconButton } from '@mui/material'
import React from 'react'
import GitHubIcon from '@mui/icons-material/GitHub';
import YouTubeIcon from '@mui/icons-material/YouTube';
import HomeIcon from '@mui/icons-material/Home';
import AddToDriveIcon from '@mui/icons-material/AddToDrive';
import { useNavigate } from 'react-router-dom';

export default function DocsNavBar() {
  const navigate = useNavigate();
  return (
    <Box sx={{
      width: '100%',
      borderBottom: '0.5px solid',
      borderBottomColor: 'divider',
      py:2,
      px:4,
    }}>
      <Box sx={{
        display: {xs: 'none',md:'flex'},
        gap: 2
      }}>
        <Button 
            startIcon={<GitHubIcon/>} 
            variant='contained'
            href='https://github.com/davidbabaev/mirage42'
            target='_blank'
            rel='noreferrer'
          >
            GitHub
          </Button>
        <Button 
            startIcon={<YouTubeIcon/>} 
            variant='contained'
            href='https://www.youtube.com/@david_kingdom'
            target='_blank'
            rel='noreferrer'
            >
            Youtube
          </Button>
        <Button 
            startIcon={<AddToDriveIcon/>} 
            variant='contained'
            href='https://drive.google.com/drive/folders/1h584KX_ducyfIwFz0EIE_QAz140hP7n2?usp=sharing'
            target='_blank'
            rel='noreferrer'
          >
            Drive Docs
          </Button>
        <Button 
            startIcon={<HomeIcon/>} 
            variant='contained'
            onClick={() => navigate('/')}
          >
            App Preview
          </Button>
      </Box>  

      <Box sx={{
        display: {xs: 'flex',md:'none'},
        gap: 2
      }}>
        <IconButton
          href='https://github.com/davidbabaev/mirage42'
          target='_blank'
          rel='noreferrer'
          >
          <GitHubIcon/>
        </IconButton>

        <IconButton
          href='https://www.youtube.com/@david_kingdom'
          target='_blank'
          rel='noreferrer'
        >
          <YouTubeIcon/>
        </IconButton>

        <IconButton
          href='https://drive.google.com/drive/folders/1h584KX_ducyfIwFz0EIE_QAz140hP7n2?usp=sharing'
          target='_blank'
          rel='noreferrer'
        >
          <AddToDriveIcon/>
        </IconButton>

        <IconButton
          onClick={() => navigate('/')}
        >
          <HomeIcon/>
        </IconButton>

      </Box>  
    </Box>
  )
}
