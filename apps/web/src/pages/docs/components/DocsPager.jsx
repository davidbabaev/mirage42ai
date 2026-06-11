import React from 'react'
import { DOCS_PAGES } from '../docsConfig'
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export default function DocsPager() {

  const currentIndex = DOCS_PAGES.findIndex(page => page.path === location.pathname)
  const prevPage = currentIndex > 0 ? DOCS_PAGES[currentIndex - 1] : null
  const nextPage = currentIndex < DOCS_PAGES.length - 1 ? DOCS_PAGES[currentIndex + 1] : null;
  
  const navigate = useNavigate();

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      p: 1,
      // mt: 4,
      borderTop: '1px solid',
      borderTopColor: 'divider'
    }}>
        {/* Prev slot */}
        {prevPage ? (
          <Box
            onClick={() => navigate(prevPage.path)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              cursor: 'pointer',
              '&:hover':{bgcolor: 'action.hover'}
            }}
          >
            <ArrowBackIcon/>
            <Box>
              <Typography fontSize={11} color='text.secondary'>Previous</Typography>
              <Typography sx={{fontSize: {xs: 13, md: 16}}} fontWeight={600}>{prevPage.label}</Typography>
            </Box>
          </Box>
        ) : (
          <Box/>
        )}

        {/* Next slot */}
        {nextPage ? (
          <Box
            onClick={() => navigate(nextPage.path)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              cursor: 'pointer',
              textAlign: 'right',
              '&:hover':{bgcolor: 'action.hover'}
            }}
          >
            <Box>
              <Typography fontSize={11} color='text.secondary'>Next</Typography>
              <Typography sx={{fontSize: {xs: 13, md: 16}}} fontWeight={600}>{nextPage.label}</Typography>
            </Box>
            <ArrowForwardIcon/>
          </Box>
        ) : (
          <Box/>
        )}
    </Box>
  )
}
