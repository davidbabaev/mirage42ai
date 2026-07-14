import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../providers/authContext";

 function useSelectedUsers() {

    const {user} = useAuth();
    const selectedUserStorageKey = user ? `selectedUsers_${user._id}` : null;

    // Lazy-init from localStorage at mount so no hydration effect is needed.
    const [selectedUsers, setSelectedUsers] = useState(() => {
        if (!selectedUserStorageKey) return [];
        const saved = JSON.parse(localStorage.getItem(selectedUserStorageKey));
        return saved || [];
    });

    const selectHandleUser = useCallback((user) => {
        setSelectedUsers((prev) => {
            const include = prev.some(sel => sel._id === user._id)

            if(!include){
                return [...prev, user]
            }

            return prev.filter(userCard => userCard._id !== user._id)
        })
    }, [])

    const handleRemoveUser = useCallback((selectedUser) => {
        setSelectedUsers((prev) => {
            return prev.filter(sel => sel._id !== selectedUser._id);
        })
    }, [])

    useEffect(() => {
        if(!selectedUserStorageKey) return;

        localStorage.setItem(selectedUserStorageKey, JSON.stringify(selectedUsers))
    }, [selectedUsers, selectedUserStorageKey])

  return {selectedUsers, selectHandleUser, handleRemoveUser}
}

export default useSelectedUsers;
