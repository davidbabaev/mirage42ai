import { Box, Button, Icon, Typography } from '@mui/material'
import React, { useEffect } from 'react'
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';


export default function ConfirmationDialog({message, onClose, onConfirm}) {

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
                display: 'flex',
                bgcolor: 'background.paper',
                borderRadius: 3,
                // p:0,
                width: '90vw',
                maxWidth: 350,
                maxHeight: 'min(85vh, 680px)',
                overflow: 'hidden',
                position: 'relative',
                p:5,
                flexDirection: 'column',
                textAlign: 'center',
                
            }}
        >

            <DeleteForeverIcon
                color = 'error'
                sx={{fontSize: 90, transform: 'rotate(10deg)', width: '100%', mb: 2}}
            />
            
            <Typography fontSize={15} lineHeight={0.5}>
                Are you sure you want to      
            </Typography>

            <Typography fontSize={20} fontWeight={700}>
                {message}                
            </Typography>

            <Box sx={{
                display: 'flex', 
                flexDirection: 'column',
                gap: 1, 
                alignItems: 'center',
                justifyContent: 'center',
                pt: 2
            }}
            >
                <Button 
                    variant='outlined'
                    color='error'
                    size='small'
                    fullWidth
                    sx={{borderRadius: 5, px: 2, py:1,fontSize: 12}}
                    endIcon={<DeleteIcon/>}
                    onClick={onConfirm}
                >
                    Delete
                </Button>

                <Button 
                    variant='contained'
                    fullWidth
                    size='small'
                    sx={{borderRadius: 5, px: 2, py:1, fontSize: 12}}
                    onClick={onClose}
                >
                    Close
                </Button>

            </Box>
        </Box>
    </Box>
  )
}
