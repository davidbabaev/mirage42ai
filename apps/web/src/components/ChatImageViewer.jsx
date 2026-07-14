import { useRef, useState } from 'react';
import { Box, CircularProgress, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ZoomableImage from './ZoomableImage';

// Fullscreen chat image viewer (WhatsApp-style).
//
// Features:
//   - Dark backdrop with the image contained via react-zoom-pan-pinch
//     (ZoomableImage): scroll + double-click zoom on desktop, pinch + double-tap
//     on mobile — gradual, not a binary toggle.
//   - Loading spinner while the full-size image loads; error fallback if it fails.
//   - Zoom resets each time the dialog opens (ZoomableImage remounts via Dialog's
//     default unmount-on-close behaviour).
//   - Dismiss: X button (≥44px), Esc (MUI Dialog), swipe-down on mobile.
//   - Focus is trapped inside the dialog (MUI Dialog default).
//   - Respects prefers-reduced-motion (no custom animation transitions added).
//
// Props:
//   src    — image URL to show
//   open   — boolean
//   onClose — called to close the viewer
export default function ChatImageViewer({ src, open, onClose }) {
    // MUI Dialog does not use keepMounted by default, so children unmount when
    // closed and remount on open — useState('loading') reinitialises automatically.
    const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'
    const touchStartY = useRef(null);
    const touchStartX = useRef(null);

    const handleLoad = () => setStatus('loaded');
    const handleError = () => setStatus('error');

    // Swipe-down to dismiss (mobile). React synthetic touch events bubble through
    // the tree even when react-zoom-pan-pinch owns native touch gestures, so this
    // outer handler still fires. Only close on a predominantly downward swipe
    // (dy > 80px, and dy > |dx| × 1.5) to avoid misfiring during pan.
    const handleTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e) => {
        if (touchStartY.current === null) return;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        const dx = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
        if (dy > 80 && dy > dx * 1.5) onClose();
        touchStartY.current = null;
        touchStartX.current = null;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            aria-label="Image viewer"
            PaperProps={{
                sx: {
                    bgcolor: '#000',
                    m: 0,
                    // Ensure the paper fills the whole viewport (fullScreen should
                    // handle this, but be explicit for safe-area insets on mobile).
                    width: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                },
            }}
        >
            {/* Close button — ≥44px touch target, always visible in top corner */}
            <IconButton
                onClick={onClose}
                aria-label="Close image viewer"
                sx={{
                    position: 'absolute',
                    top: { xs: 8, md: 16 },
                    right: { xs: 8, md: 16 },
                    zIndex: 10,
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    width: 44,
                    height: 44,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                }}
            >
                <CloseIcon />
            </IconButton>

            {/* Main content — swipe-down handler lives here */}
            <Box
                sx={{ width: '100%', height: '100%', position: 'relative' }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Loading spinner (shown while ZoomableImage is invisible) */}
                {status === 'loading' && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <CircularProgress sx={{ color: '#fff' }} />
                    </Box>
                )}

                {/* Error fallback */}
                {status === 'error' && (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255,255,255,0.7)',
                            gap: 1,
                        }}
                    >
                        <ErrorOutlineIcon sx={{ fontSize: 56 }} />
                        <Typography fontSize={15}>Failed to load image</Typography>
                    </Box>
                )}

                {/* ZoomableImage — rendered at opacity 0 while loading so the img
                    fires onLoad even before it's visible, then fades in. Hidden
                    (not unmounted) so the browser can start fetching immediately. */}
                {status !== 'error' && (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            opacity: status === 'loaded' ? 1 : 0,
                            // Respect prefers-reduced-motion: only add a transition
                            // when the user hasn't opted out.
                            '@media (prefers-reduced-motion: no-preference)': {
                                transition: 'opacity 0.15s ease',
                            },
                        }}
                    >
                        <ZoomableImage
                            mediaUrl={src}
                            height="100%"
                            alt="Full-size chat image"
                            onLoad={handleLoad}
                            onError={handleError}
                        />
                    </Box>
                )}
            </Box>
        </Dialog>
    );
}
