import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider";

 function useSelectedUsers() {

    const [selectedUsers, setSelectedUsers] = useState([])
    const {user} = useAuth();
    const [isUserLoaded, setIsUserLoaded] = useState(false)

    const selectedUserStorageKey = user ? `selectedUsers_${user._id}` : null;
    
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

        const savedSelected = JSON.parse(localStorage.getItem(selectedUserStorageKey))
        if(savedSelected){
            setSelectedUsers(savedSelected)
        }

        setIsUserLoaded(true)
    }, [selectedUserStorageKey])

    useEffect(() => {
        if(!isUserLoaded) return;
        if(!selectedUserStorageKey) return;

        localStorage.setItem(selectedUserStorageKey, JSON.stringify(selectedUsers))
    }, [selectedUsers, selectedUserStorageKey, isUserLoaded])

  return {selectedUsers, selectHandleUser, handleRemoveUser}
}

export default useSelectedUsers;
