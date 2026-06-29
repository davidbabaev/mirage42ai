import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import { useManagedVideo } from '../providers/VideoCoordinatorProvider';
import ZoomableImage from './ZoomableImage';

// Coordinated video: participates in the single-active-video coordinator.
// Used for the feed card and the post-details modal.
function ManagedVideo({ mediaUrl, style, mode }) {
    const videoRef = useRef(null);
    useManagedVideo({ videoRef, mediaUrl, mode });
    return (
        <video
            ref={videoRef}
            src={mediaUrl}
            controls
            playsInline
            muted={mode === 'feed'}
            preload={mode === 'modal' ? 'auto' : 'metadata'}
            style={style}
        />
    );
}

// Image that degrades gracefully when its URL fails to load (e.g. a broken
// or deleted Cloudinary asset) instead of showing the browser's broken-image
// glyph. Reports the failure to the caller via onError so composers can react.
function ImageWithFallback({ mediaUrl, style, onError }) {
    const [errored, setErrored] = useState(false);

    useEffect(() => { setErrored(false); }, [mediaUrl]);

    if (errored) {
        return (
            <Box
                role='img'
                aria-label='Image unavailable'
                sx={{
                    width: '100%',
                    minHeight: 180,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                    borderRadius: typeof style?.borderRadius === 'string' ? style.borderRadius : 1,
                }}
            >
                <BrokenImageOutlinedIcon fontSize='large' />
                <Typography fontSize={13}>Image unavailable</Typography>
            </Box>
        );
    }

    return (
        <img
            src={mediaUrl}
            style={style}
            onError={() => { setErrored(true); onError?.(); }}
        />
    );
}

export default function MediaDisplay({mediaUrl, mediaType, style, videoMode = 'passive', zoomable = false, onError}) {
    if(mediaType === 'video'){
        if (videoMode === 'feed' || videoMode === 'modal') {
            return <ManagedVideo mediaUrl={mediaUrl} style={style} mode={videoMode} />
        }
        // passive: plain controlled video, no coordinator participation
        return <video src={mediaUrl} controls style={style} onError={() => onError?.()}/>
    }
    // zoomable images get pinch/scroll/double-click zoom + pan (post modal only)
    if (zoomable) {
        return <ZoomableImage mediaUrl={mediaUrl} />
    }
    return <ImageWithFallback mediaUrl={mediaUrl} style={style} onError={onError} />
}
