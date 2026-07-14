import { createContext, useContext } from 'react';

export const UsersContext = createContext();

export function useUsersProvider() {
    return useContext(UsersContext);
}
