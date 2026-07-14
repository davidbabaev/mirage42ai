import React, { useMemo, useRef, useState } from 'react'
import { VideoApiContext, VideoActiveContext } from './videoCoordinatorContext';

export function VideoCoordinatorProvider({ children }) {
    const [activeId, setActiveId] = useState(null);
    // mediaUrl -> { time, muted }. A ref, not state: positions are written on
    // every `timeupdate`/pause and must never trigger a re-render.
    const positionsRef = useRef(new Map());

    const api = useMemo(() => ({
        // Claim the single active slot. Idempotent: re-claiming the same id is a
        // no-op for React, so a play event that fires while already active does
        // not loop.
        requestActive: (instanceId) =>
            setActiveId((prev) => (prev === instanceId ? prev : instanceId)),
        // Guarded: a late-unmounting instance can't clear someone else's claim.
        release: (instanceId) =>
            setActiveId((prev) => (prev === instanceId ? null : prev)),
        savePosition: (mediaUrl, time, muted) => {
            if (!mediaUrl) return;
            positionsRef.current.set(mediaUrl, { time, muted });
        },
        consumePosition: (mediaUrl) =>
            (mediaUrl ? positionsRef.current.get(mediaUrl) ?? null : null),
    }), []);

    return (
        <VideoApiContext.Provider value={api}>
            <VideoActiveContext.Provider value={activeId}>
                {children}
            </VideoActiveContext.Provider>
        </VideoApiContext.Provider>
    );
}
