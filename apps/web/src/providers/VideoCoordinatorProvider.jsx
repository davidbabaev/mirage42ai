import React, { createContext, useContext, useId, useMemo, useRef, useState, useEffect } from 'react'

// Single source of truth for "which video is allowed to play".
// `activeId` (the instance id permitted to play) lives in its own context so
// that changing it re-runs only the lightweight enforcement effect in each
// video, while the method API lives in a separate, stable context so attaching
// native listeners happens once per video (not on every active-id change).
const VideoApiContext = createContext(null);     // stable: methods + position map
const VideoActiveContext = createContext(null);  // changes: active instance id

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

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const noop = () => {};

// Wires a single <video> (via videoRef) into the coordinator.
//   mode 'feed'  -> muted preview; pauses whenever it isn't the active video.
//   mode 'modal' -> on mount: resume the feed's timestamp, claim active, and
//                   autoplay with sound (the modal opens from a user gesture).
// If the provider isn't mounted (api === null) every effect short-circuits and
// the <video> behaves like a plain controlled element.
export function useManagedVideo({ videoRef, mediaUrl, mode }) {
    const api = useContext(VideoApiContext);
    const activeId = useContext(VideoActiveContext);
    const instanceId = useId();
    // Set true right before any coordinator-driven pause() so the resulting
    // native 'pause' event is ignored (it must not be treated as a user pause).
    const programmaticPauseRef = useRef(false);
    const reducedMotion = useMemo(() => prefersReducedMotion(), []);

    // Native listeners — attached once (api identity is stable).
    useEffect(() => {
        if (!api) return undefined;
        const v = videoRef.current;
        if (!v) return undefined;

        const onPlay = () => api.requestActive(instanceId); // manual play claims active -> others pause
        const onPause = () => {
            if (programmaticPauseRef.current) {
                programmaticPauseRef.current = false; // coordinator-driven pause: ignore
                return;
            }
            // genuine user pause: remember position, but do NOT release (pausing
            // yourself shouldn't promote some other video to play).
            api.savePosition(mediaUrl, v.currentTime, v.muted);
        };
        const onTimeUpdate = () => api.savePosition(mediaUrl, v.currentTime, v.muted);

        v.addEventListener('play', onPlay);
        v.addEventListener('pause', onPause);
        v.addEventListener('timeupdate', onTimeUpdate);

        return () => {
            v.removeEventListener('play', onPlay);
            v.removeEventListener('pause', onPause);
            v.removeEventListener('timeupdate', onTimeUpdate);
            api.savePosition(mediaUrl, v.currentTime, v.muted);
            // Only arm the guard when a pause event will actually fire, so the
            // flag can't latch true on an already-paused element.
            if (!v.paused) {
                programmaticPauseRef.current = true;
                v.pause();
            }
            api.release(instanceId);
        };
    }, [api, videoRef, mediaUrl, instanceId]);

    // Enforcement — react to who is active.
    useEffect(() => {
        if (!api) return;
        const v = videoRef.current;
        if (!v) return;
        if (activeId === instanceId) {
            if (!reducedMotion) {
                Promise.resolve(v.play()).catch(() => {
                    // Autoplay policy rejected an unmuted play (e.g. the opening
                    // gesture didn't carry through). Fall back to muted playback
                    // rather than leaving the active video stuck paused.
                    v.muted = true;
                    Promise.resolve(v.play()).catch(noop);
                });
            }
        } else if (!v.paused) {
            programmaticPauseRef.current = true;
            v.pause();
        }
    }, [api, activeId, instanceId, reducedMotion, videoRef]);

    // Scroll-based autoplay (feed only): play when the video is ≥60% visible in
    // the scroll container, pause when it falls below. This only drives the
    // coordinator (requestActive/release) — the enforcement effect above does the
    // actual play/pause, so "only one plays at a time" and the reduced-motion
    // guard are inherited for free. Muted + playsInline (set in MediaDisplay)
    // satisfy the browser autoplay policy.
    useEffect(() => {
        if (!api || mode !== 'feed') return undefined;
        // Feature-detect (same defensive style as prefersReducedMotion): jsdom/SSR
        // don't implement IntersectionObserver, so skip scroll-autoplay there.
        if (typeof IntersectionObserver === 'undefined') return undefined;
        const v = videoRef.current;
        if (!v) return undefined;

        const root = document.getElementById('app-scroll-container');
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.intersectionRatio >= 0.6) {
                    if (!reducedMotion) api.requestActive(instanceId);
                } else {
                    api.release(instanceId);
                }
            },
            { root: root || null, threshold: [0.6] }
        );
        observer.observe(v);
        return () => observer.disconnect();
    }, [api, mode, instanceId, reducedMotion, videoRef]);

    // Mount-time setup: modal hand-off, or feed black-box first-frame paint.
    useEffect(() => {
        if (!api) return undefined;
        const v = videoRef.current;
        if (!v) return undefined;

        if (mode === 'modal') {
            const saved = api.consumePosition(mediaUrl);
            const applySeek = () => {
                if (saved && Number.isFinite(saved.time)) {
                    try { v.currentTime = saved.time; } catch { /* not seekable yet */ }
                }
            };
            if (v.readyState >= 1) applySeek();
            else v.addEventListener('loadedmetadata', applySeek, { once: true });
            v.muted = false; // opened from a click -> sound allowed
            api.requestActive(instanceId); // claim active; enforcement effect plays it
            return () => v.removeEventListener('loadedmetadata', applySeek);
        }

        if (mode === 'feed') {
            // No poster field exists in the data model; nudge a real frame so a
            // paused feed video never renders as a black box.
            const paintFrame = () => {
                if (v.paused && v.currentTime === 0 && Number.isFinite(v.duration)) {
                    try { v.currentTime = Math.min(0.1, v.duration); } catch { /* ignore */ }
                }
            };
            if (v.readyState >= 1) paintFrame();
            else v.addEventListener('loadedmetadata', paintFrame, { once: true });
            return () => v.removeEventListener('loadedmetadata', paintFrame);
        }

        return undefined;
    }, [api, mode, mediaUrl, instanceId, videoRef]);
}
