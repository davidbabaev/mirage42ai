import { useCallback, useEffect, useRef, useState } from "react";
import { deleteOneNotification, getNotifications, markNotificationsAsRead } from "../services/apiService";
import { useAuth } from "../providers/AuthProvider";
import { useCursorPagination } from "./useCursorPagination";

const PAGE_SIZE = 20;

function useNotifications() {

    const { isLoggedIn } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    // Monotonic token guarding the badge: only the newest first-page fetch may
    // set the count, and markAsRead bumps it so a late/overlapping fetch can't
    // resurrect a stale unread count after the user has cleared it.
    const unreadTok = useRef(0);

    // Fetcher for the cursor-paginated list. The first page (no cursor) also
    // carries the server-computed unreadCount over ALL rows, so the bell badge
    // stays correct no matter how far the panel is scrolled.
    const fetchPage = useCallback(async (cursor) => {
        const isFirst = !cursor;
        const tok = isFirst ? ++unreadTok.current : unreadTok.current;
        const res = await getNotifications(cursor, PAGE_SIZE);
        if (isFirst && typeof res?.unreadCount === 'number' && tok === unreadTok.current) {
            setUnreadCount(res.unreadCount);
        }
        return { items: res?.items ?? [], nextCursor: res?.nextCursor ?? null };
    }, []);

    const {
        items: notifications, setItems,
        hasMore, loading, loadingMore, error,
        refresh, loadMore,
    } = useCursorPagination(fetchPage);

    // Load the first page on login. Panel-open also refreshes (see NavBar) so
    // notifications that arrived during the session surface newest-first.
    useEffect(() => {
        const token = localStorage.getItem('auth-token');
        if (!token) return;
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]);

    const handleDeleteNotification = async (notificationId) => {
        const target = notifications.find(n => n._id === notificationId);
        setItems(prev => prev.filter(n => n._id !== notificationId));
        if (target && target.isRead === false) {
            setUnreadCount(c => Math.max(0, c - 1));
        }
        try {
            await deleteOneNotification(notificationId);
        } catch (err) {
            console.log(err.message);
            refresh(); // re-sync the loaded window on failure
        }
    }

    const handleMarkAsRead = async () => {
        unreadTok.current++;       // supersede any in-flight first-page unread update
        setUnreadCount(0);         // optimistic: clear the badge immediately
        try {
            await markNotificationsAsRead();
            setItems(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.log(err.message);
        }
    }

    return {
        getUserNotifications: refresh,
        refreshNotifications: refresh,
        unreadCount,
        notifications,
        loading,
        loadingMore,
        hasMore,
        error,
        loadMore,
        handleDeleteNotification,
        handleMarkAsRead,
    }
}

export default useNotifications;
