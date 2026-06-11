import CardDetailsModal from './CardDetailsModal';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect } from 'react';

export default function CardPopupModal({cardId, onClose}) {

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }

  }, [])

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
        <Box
          sx={{
            bgcolor: 'background.paper',
            width: {xs:'100%', md:'90vw'},
            maxWidth: {xs:'100%', md: 900},
            height: {xs: '100dvh', md: 'auto'},
            maxHeight: {xs: '100dvh',md:'min(85vh, 680px)'},
            borderRadius: {xs: 0, md:3},
            overflow: {xs: 'auto', md: 'hidden'},
            position: 'relative',
          }}
        >
          <Box sx={{position: 'relative', height: '100%'}}>
            <IconButton 
              onClick={onClose}
              sx={{
                position: 'absolute',
                top: 9,
                right: 3,
                // m: 1,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  p:0.5,
                  '&:hover': {bgcolor: 'rgba(0,0,0,0.7)'}
                // zIndex: 1100,
                // '&:hover':{
                //   bgcolor: 'background.paper'
                // }
              }}
            >
              <CloseIcon/>
            </IconButton>

            <CardDetailsModal
              cardId = {cardId}
              onClose = {onClose}
            />

          </Box>


        </Box>
    </Box>
  )
}
