import { Box } from '@mui/material';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// Zoomable image for the post-details modal. Gives a stable "stage" the
// image is contained within (objectFit: contain), then layers pan/zoom on top:
// - desktop: scroll-to-zoom + double-click to toggle zoom, drag to pan
// - mobile: pinch-to-zoom, drag to pan
// Panning is bound to the image so it can't be dragged off the stage, and the
// view resets to fit whenever it returns to 1x.
export default function ZoomableImage({ mediaUrl }) {
    return (
        <Box sx={{
            width: '100%',
            // The modal's left pane has no intrinsic height on mobile (column
            // layout), so give the zoom stage a definite height there; on
            // desktop it stretches to fill the pane.
            height: { xs: '45vh', md: '100%' },
            overflow: 'hidden',
            touchAction: 'none', // let the library own touch gestures (pinch/pan)
        }}>
            <TransformWrapper
                minScale={1}
                maxScale={4}
                doubleClick={{ mode: 'toggle', step: 2 }}
                wheel={{ step: 0.15 }}
                pinch={{ step: 5 }}
                centerZoomedOut
            >
                <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%', cursor: 'grab' }}
                    contentStyle={{ width: '100%', height: '100%' }}
                >
                    <img
                        src={mediaUrl}
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
