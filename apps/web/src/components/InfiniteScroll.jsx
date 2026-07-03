import React, { useCallback, useRef } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';

// Reusable infinite-scroll wrapper. The parent owns the list state via
// useCursorPagination and renders the items as `children`; this component adds
// the sentinel + all loading/empty/end/error affordances with a consistent
// centered MUI CircularProgress spinner.
//
// For window-scrolled pages leave `root` null. For modal / inner-scroll lists
// (Dialog content, dropdowns), pass the scroll-container element as `root` so
// the IntersectionObserver watches the right viewport.
export default function InfiniteScroll({
    children,
    loading,          // initial page in flight (list still empty)
    loadingMore,      // a subsequent page in flight
    hasMore,
    error,
    isEmpty,          // loaded, zero items
    onLoadMore,
    onRetry,
    root = null,      // scroll-container element for modals; null = window
    rootMargin = '400px',
    emptyState = null,
    endLabel = "You're all caught up",
    showEnd = true,   // some short lists don't want an end marker
}) {
    const observerRef = useRef(null);
    // Callback ref: re-attaches the observer each time the sentinel mounts (it
    // unmounts while a page loads, then remounts if more remain — also auto-fills
    // a short viewport).
    const sentinelRef = useCallback((node) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }
        if (node) {
            observerRef.current = new IntersectionObserver((entries) => {
                if (entries[0]?.isIntersecting) onLoadMore();
            }, { root, rootMargin });
            observerRef.current.observe(node);
        }
    }, [onLoadMore, root, rootMargin]);

    return (
        <>
            {children}

            {/* Initial load */}
            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} aria-busy="true" aria-label="Loading">
                    <CircularProgress size={28} />
                </Box>
            )}

            {/* Empty (loaded, nothing) */}
            {!loading && !error && isEmpty && (
                emptyState ?? (
                    <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                        <Typography variant="body2">Nothing here yet.</Typography>
                    </Box>
                )
            )}

            {/* Error loading a page — inline retry, no silent stall */}
            {error && (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography color="error" variant="body2" gutterBottom>Couldn't load more.</Typography>
                    <Button size="small" variant="outlined" onClick={onRetry ?? onLoadMore}>Retry</Button>
                </Box>
            )}

            {/* Loading the next page */}
            {loadingMore && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }} aria-busy="true" aria-label="Loading more">
                    <CircularProgress size={22} />
                </Box>
            )}

            {/* Sentinel — hidden while a page loads or after an error (no auto-retry loop) */}
            {hasMore && !loadingMore && !error && (
                <Box ref={sentinelRef} sx={{ height: 1 }} />
            )}

            {/* End of list */}
            {showEnd && !hasMore && !loading && !error && !isEmpty && endLabel && (
                <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
                    <Typography variant="caption">{endLabel}</Typography>
                </Box>
            )}
        </>
    );
}
