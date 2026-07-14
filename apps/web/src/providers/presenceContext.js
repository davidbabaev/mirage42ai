import { createContext, useContext } from 'react';

export const PresenceContext = createContext({ onlineIds: new Set(), isOnline: () => false });

export function usePresence() {
    return useContext(PresenceContext);
}
