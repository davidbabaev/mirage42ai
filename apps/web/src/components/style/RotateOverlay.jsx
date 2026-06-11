import { Box, Typography } from '@mui/material'
import React from 'react'
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';

export default function RotateOverlay() {
  return (
    <Box
        sx={{
            display: 'flex',
            position: 'fixed',
            inset: 0,
            bgcolor: 'background.default',
            color: 'text.primary',
            zIndex: 99999,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,

            // only kicks in on small landscape screen (phones)
            // tablets/ laptops in landscape have height > 500, so they're safe

            // hidden state (default - portrait)
            opacity: 0,
            visibility: 'hidden',
            transition: 'opacity 0.3s ease, visibility 0.3s ease',

            '@media (orientation: landscape) and (max-height: 500px)' : {
                opacity: 1,
                visibility: 'visible'
            }
        }}
    >
        <ScreenRotationIcon sx={{fontSize: 60, color: 'primary.main'}}/>
        <Typography fontWeight={700} fontSize={20}>
            Please rotate your device
        </Typography>

        <Typography color='text.secondary' fontSize={14}>
            Mirage works best in portrait mode on mobile
        </Typography>
    </Box>
  )
}
