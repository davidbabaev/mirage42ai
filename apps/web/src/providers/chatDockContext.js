import { createContext, useContext } from 'react';

export const ChatDockContext = createContext(null);

export function useChatDock() {
    return useContext(ChatDockContext);
}
