// TEMPORARY DEBUG INSTRUMENTATION — to be removed once the
// "feed video keeps playing under the modal" bug is rooted out.
import { useEffect, useRef } from 'react';

function shortSrc(url) {
    if (!url) return '(empty)';
    return url.slice(-50);
}

function VideoWithLogs({ mediaUrl, style }) {
    const ref = useRef(null);

    useEffect(() => {
        const tag = shortSrc(mediaUrl);
        console.log('[MediaDisplay] MOUNT video', tag);
        return () => console.log('[MediaDisplay] UNMOUNT video', tag);
    }, [mediaUrl]);

    return (
        <video
            ref={ref}
            src={mediaUrl}
            controls
            style={style}
            onPlay={(e) => console.log('[MediaDisplay] PLAY fired', {
                src: shortSrc(e.currentTarget.currentSrc),
                isTrusted: e.nativeEvent.isTrusted, // true = user click, false = code
                paused: e.currentTarget.paused,
                t: performance.now().toFixed(0),
            })}
            onPause={(e) => console.log('[MediaDisplay] PAUSE fired', {
                src: shortSrc(e.currentTarget.currentSrc),
                isTrusted: e.nativeEvent.isTrusted,
                t: performance.now().toFixed(0),
            })}
        />
    );
}

export default function MediaDisplay({mediaUrl, mediaType, style}) {
    if(mediaType === 'video'){
        return <VideoWithLogs mediaUrl={mediaUrl} style={style} />
    }
    return <img src={mediaUrl} style={style}/>
}
