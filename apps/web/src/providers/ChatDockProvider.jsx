import { createContext, useCallback, useContext, useState } from 'react';

// Global state for the LinkedIn-style docked messaging. Lives above the router
// so it persists across navigation. There is a single persistent "Messaging" bar
// (rendered by <ChatDock/>) plus AT MOST ONE open chat window at a time — opening
// a different conversation replaces the current window. Desktop-only rendering is
// decided by <ChatDock/>; on mobile callers fall back to the full-screen /chat.
const ChatDockContext = createContext(null);

export function ChatDockProvider({ children }) {
    // the other user of the single open chat window (null = no window open)
    const [openUser, setOpenUser] = useState(null);
    // whether the Messaging bar's conversation list is expanded
    const [barOpen, setBarOpen] = useState(true);

    // Open (or switch to) the chat with this user — replaces any open window.
    const openChat = useCallback((otherUser) => {
        if (!otherUser?._id) return;
        setOpenUser(otherUser);
        setBarOpen(true);
    }, []);

    const closeChat = useCallback(() => setOpenUser(null), []);

    const toggleBar = useCallback(() => setBarOpen((v) => !v), []);

    return (
        <ChatDockContext.Provider value={{
            openUser,
            openChat,
            closeChat,
            barOpen,
            toggleBar,
            // back-compat alias: the profile "Message" button calls openDock
            openDock: openChat,
        }}>
            {children}
        </ChatDockContext.Provider>
    );
}

export function useChatDock() {
    return useContext(ChatDockContext);
}
