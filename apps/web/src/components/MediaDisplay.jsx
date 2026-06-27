import { useRef } from 'react';
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

export default function MediaDisplay({mediaUrl, mediaType, style, videoMode = 'passive', zoomable = false}) {
    if(mediaType === 'video'){
        if (videoMode === 'feed' || videoMode === 'modal') {
            return <ManagedVideo mediaUrl={mediaUrl} style={style} mode={videoMode} />
        }
        // passive: plain controlled video, no coordinator participation
        return <video src={mediaUrl} controls style={style}/>
    }
    // zoomable images get pinch/scroll/double-click zoom + pan (post modal only)
    if (zoomable) {
        return <ZoomableImage mediaUrl={mediaUrl} />
    }
    return <img src={mediaUrl} style={style}/>
}
