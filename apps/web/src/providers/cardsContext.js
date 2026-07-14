import { createContext, useContext } from 'react';

export const CardsContext = createContext();

export function useCardsProvider() {
    return useContext(CardsContext);
}
