import { createContext, useContext } from 'react';

export const ChatContext = createContext(null);

export function useChatList() {
    return useContext(ChatContext);
}
