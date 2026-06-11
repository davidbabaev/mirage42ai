import React, { useEffect } from 'react'
import CreateCardForm from './CreateCardForm'
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function CreateCardModal({card, onClose, onCardPosted, mediaButton}) {

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
        alignItems: 'center'
      }}
    >
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: {xs:0, md:3},
            p: 1,
            width: {xs: '100%' ,md: 560},
            height: {xs: '100dvh', md: 'auto'},
            maxHeight: {xs: '100dvh',md: '90vh'},
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
            <IconButton 
              onClick={onClose}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
              }}
            >
              <CloseIcon/>
            </IconButton>

            <CreateCardForm
                card={card}
                onSuccess={() => {
                    onCardPosted();
                    onClose();
                }}
                mediaButton={mediaButton}
            />
        </Box>
    </Box>
  )
}
