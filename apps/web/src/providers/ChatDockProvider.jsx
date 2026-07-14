import { useCallback, useState } from 'react';
import { ChatDockContext } from './chatDockContext';

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

