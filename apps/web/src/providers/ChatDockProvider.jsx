import { createContext, useCallback, useContext, useState } from 'react';

// Global state for LinkedIn/Facebook-style docked chat windows. Lives above the
// router so windows persist across navigation. Desktop-only rendering is decided
// by <ChatDock/>; on mobile callers fall back to the full-screen /chat page.
const ChatDockContext = createContext(null);

const MAX_DOCKS = 3; // keep the bottom bar from overflowing on desktop

export function ChatDockProvider({ children }) {
    // each dock: { otherUser, minimized }
    const [docks, setDocks] = useState([]);

    const openDock = useCallback((otherUser) => {
        if (!otherUser?._id) return;
        setDocks((prev) => {
            const existing = prev.find((d) => d.otherUser._id === otherUser._id);
            if (existing) {
                // bring to front + un-minimize
                return [
                    { ...existing, minimized: false },
                    ...prev.filter((d) => d.otherUser._id !== otherUser._id),
                ];
            }
            const next = [{ otherUser, minimized: false }, ...prev];
            return next.slice(0, MAX_DOCKS);
        });
    }, []);

    const closeDock = useCallback((userId) => {
        setDocks((prev) => prev.filter((d) => d.otherUser._id !== userId));
    }, []);

    const toggleMinimize = useCallback((userId) => {
        setDocks((prev) => prev.map((d) =>
            d.otherUser._id === userId ? { ...d, minimized: !d.minimized } : d
        ));
    }, []);

    return (
        <ChatDockContext.Provider value={{ docks, openDock, closeDock, toggleMinimize }}>
            {children}
        </ChatDockContext.Provider>
    );
}

export function useChatDock() {
    return useContext(ChatDockContext);
}
