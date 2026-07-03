import { useCallback, useRef, useState } from 'react';

// Generic keyset/cursor infinite-scroll state. `fetchPage(cursor)` must resolve
// to { items, nextCursor } where nextCursor is an opaque string or null at the
// end. Reusable across the feed now; comments and user lists can adopt it later.
//
// Guarantees the UI relies on:
//  - overlapping loads are suppressed (fast scroll can't double-fetch a page),
//  - a refresh() mid-flight supersedes any in-flight loadMore (no stale append),
//  - appended pages are de-duped by _id defensively.
export function useCursorPagination(fetchPage) {
    const [items, setItems] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);        // initial page in flight
    const [loadingMore, setLoadingMore] = useState(false); // a later page in flight
    const [error, setError] = useState(null);

    const inFlight = useRef(false);
    // Monotonic token: a refresh bumps it so any older in-flight response is dropped.
    const loadToken = useRef(0);

    const refresh = useCallback(async () => {
        const token = ++loadToken.current;
        inFlight.current = true;
        setLoading(true);
        setError(null);
        try {
            const { items: pageItems, nextCursor: nc } = await fetchPage(undefined);
            if (token !== loadToken.current) return; // superseded by a newer refresh
            setItems(pageItems ?? []);
            setNextCursor(nc ?? null);
            setHasMore(!!nc);
        } catch (err) {
            if (token === loadToken.current) setError(err);
        } finally {
            if (token === loadToken.current) {
                setLoading(false);
                inFlight.current = false;
            }
        }
    }, [fetchPage]);

    const loadMore = useCallback(async () => {
        if (inFlight.current || !hasMore || !nextCursor) return;
        const token = loadToken.current;
        inFlight.current = true;
        setLoadingMore(true);
        setError(null);
        try {
            const { items: pageItems, nextCursor: nc } = await fetchPage(nextCursor);
            if (token !== loadToken.current) return; // a refresh happened mid-flight
            setItems(prev => {
                const seen = new Set(prev.map(i => i._id));
                const fresh = (pageItems ?? []).filter(i => !seen.has(i._id));
                return fresh.length ? [...prev, ...fresh] : prev;
            });
            setNextCursor(nc ?? null);
            setHasMore(!!nc);
        } catch (err) {
            if (token === loadToken.current) setError(err);
        } finally {
            if (token === loadToken.current) {
                setLoadingMore(false);
                inFlight.current = false;
            }
        }
    }, [fetchPage, hasMore, nextCursor]);

    const reset = useCallback(() => {
        loadToken.current++;      // invalidate any in-flight response
        inFlight.current = false;
        setItems([]);
        setNextCursor(null);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        setError(null);
    }, []);

    return {
        items, setItems,
        hasMore, loading, loadingMore, error,
        refresh, loadMore, reset,
    };
}
