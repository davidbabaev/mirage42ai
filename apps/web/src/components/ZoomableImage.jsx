import { Box } from '@mui/material';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// Zoomable image for the post-details modal and the fullscreen chat image
// viewer. Gives a stable "stage" the image is contained within
// (objectFit: contain), then layers pan/zoom on top:
// - desktop: scroll-to-zoom (gradual) + double-click to step in, drag to pan
// - mobile: pinch-to-zoom (gradual), drag to pan
// Zoom is continuous between fit-to-view (1x) and 4x — wheel/pinch move it in
// small increments rather than snapping to a fixed level. Panning is bound to
// the image so it can't be dragged off the stage, and the view resets to fit
// whenever it returns to 1x.
//
// Props:
//   mediaUrl  — image src (required)
//   height    — CSS height for the stage; defaults to { xs: '45vh', md: '100%' }
//               (post modal); pass '100%' for the fullscreen chat viewer.
//   alt       — alt text for the img element (default 'Image')
//   onLoad    — called when the img has loaded (optional)
//   onError   — called if the img fails to load (optional)
export default function ZoomableImage({ mediaUrl, height, alt, onLoad, onError }) {
    return (
        <Box sx={{
            width: '100%',
            // The modal's left pane has no intrinsic height on mobile (column
            // layout), so give the zoom stage a definite height there; on
            // desktop it stretches to fill the pane.
            height: height ?? { xs: '45vh', md: '100%' },
            overflow: 'hidden',
            touchAction: 'none', // let the library own touch gestures (pinch/pan)
        }}>
            <TransformWrapper
                minScale={1}
                maxScale={4}
                // Smooth wheel zoom multiplies step by |deltaY| (~120 per mouse
                // notch), so a small step keeps each notch a gentle increment
                // (~0.3x) instead of slamming to maxScale in one tick.
                doubleClick={{ mode: 'zoomIn', step: 0.5 }}
                wheel={{ step: 0.0025 }}
                pinch={{ step: 5 }}
                centerZoomedOut
            >
                <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%', cursor: 'grab' }}
                    contentStyle={{ width: '100%', height: '100%' }}
                >
                    <img
                        src={mediaUrl}
                        alt={alt ?? 'Image'}
                        onLoad={onLoad}
                        onError={onError}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            display: 'block',
                        }}
                    />
                </TransformComponent>
            </TransformWrapper>
        </Box>
    );
}
