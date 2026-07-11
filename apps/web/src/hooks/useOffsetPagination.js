import { useCallback, useRef, useState } from 'react';

// Generic offset/numbered-page pagination hook. `fetcher(params)` must resolve to
// { items, total, page, limit }. The hook owns page and pageSize state and provides
// refresh / setPage / setPageSize / refetch controls.
//
// Design choices:
//  - `refresh(extraParams)` resets to page 1 and stores the filter params; those
//    params are replayed automatically on every subsequent setPage / setPageSize.
//  - `refetch()` re-runs the last fetch (same page + params) — use after mutations.
//  - A monotonic loadToken cancels stale responses when a newer fetch starts.
//  - Mirrors useCursorPagination's style: named export, useRef for cancel safety.
export function useOffsetPagination(fetcher) {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPageState] = useState(1);
    const [pageSize, setPageSizeState] = useState(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadToken = useRef(0);
    // stateRef keeps the mutable source-of-truth so closures always see the latest
    // page, pageSize, and extraParams without stale-closure issues.
    const stateRef = useRef({ page: 1, pageSize: 10, extraParams: {} });

    const doLoad = useCallback(async (p, ps, extra) => {
        const token = ++loadToken.current;
        setLoading(true);
        setError(null);
        try {
            const result = await fetcher({ page: p, limit: ps, ...extra });
            if (token !== loadToken.current) return; // superseded by a newer call
            setItems(result.items ?? []);
            setTotal(result.total ?? 0);
        } catch (err) {
            if (token === loadToken.current) setError(err);
        } finally {
            if (token === loadToken.current) setLoading(false);
        }
    }, [fetcher]);

    // Reset to page 1 and fetch with new filter params. Stores those params so
    // subsequent setPage / setPageSize / refetch calls replay them.
    const refresh = useCallback((extra = {}) => {
        stateRef.current.extraParams = extra;
        stateRef.current.page = 1;
        setPageState(1);
        doLoad(1, stateRef.current.pageSize, extra);
    }, [doLoad]);

    // Navigate to a specific page (keeps current params).
    const setPage = useCallback((p) => {
        stateRef.current.page = p;
        setPageState(p);
        doLoad(p, stateRef.current.pageSize, stateRef.current.extraParams);
    }, [doLoad]);

    // Change page size and reset to page 1.
    const setPageSize = useCallback((ps) => {
        stateRef.current.pageSize = ps;
        stateRef.current.page = 1;
        setPageSizeState(ps);
        setPageState(1);
        doLoad(1, ps, stateRef.current.extraParams);
    }, [doLoad]);

    // Re-run the exact same fetch (current page, size, params) — useful after mutations.
    const refetch = useCallback(() => {
        doLoad(
            stateRef.current.page,
            stateRef.current.pageSize,
            stateRef.current.extraParams,
        );
    }, [doLoad]);

    return { items, total, page, pageSize, loading, error, refresh, setPage, setPageSize, refetch };
}
