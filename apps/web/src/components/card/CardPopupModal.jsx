import CardDetailsModal from './CardDetailsModal';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect, useRef } from 'react';

export default function CardPopupModal({cardId, onClose}) {

  const containerRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    // Pause any <video> playing behind the modal (e.g. a feed card video) so
    // its audio doesn't keep leaking through under the now-foregrounded details
    // view. SCOPED: only pause videos OUTSIDE this modal — the modal's own
    // video (rendered inside CardDetailsModal) must be left alone so the user
    // can click play on it.
    const modalEl = containerRef.current;
    // Defensive: if the ref hasn't attached for any reason, skip the sweep
    // entirely rather than fall through to pausing the modal's own video.
    if (modalEl) {
      document.querySelectorAll('video').forEach((v) => {
        if (modalEl.contains(v)) return;
        v.pause();
      })
    }
    return () => {
      document.body.style.overflow = 'unset'
    }

  }, [])

  return (
    <Box
      ref={containerRef}
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
