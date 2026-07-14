import { createContext, useContext } from 'react';

export const UIContext = createContext();

export function useUI() {
    return useContext(UIContext);
}
