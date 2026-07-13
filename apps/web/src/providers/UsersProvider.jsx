import React, { createContext, useContext, useEffect, useState } from 'react'
import { banUser, deleteUser, getAllUsers, promoteUser} from "../services/apiService";
import { useAuth } from "./AuthProvider";

const UsersContext = createContext();

export function UsersProvider({children}) {

    // state and handlers go here
        const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)
    const {isLoggedIn} = useAuth();


    const getUsers = async () => {
        // GET /users now requires auth; skip while logged out (avoids a 401).
        const token = localStorage.getItem('auth-token')
        if(!token) return;
        setLoading(true)
        try{
            const response = await getAllUsers();
            setUsers(response.map((user)=> {
                return{
                    ...user,
                    profilePicture: user.profilePicture || 'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
                }
            }));
        }
        catch(err){
            console.log(err.message);
        }
        finally{
            setLoading(false)
        }
    }

    // Patch a single user in the list in place (e.g. after follow/unfollow),
    // so follower/following counts derived from `users` stay correct without
    // re-fetching everyone. Keeps the existing profilePicture fallback.
    const syncUser = (updatedUser) => {
        if (!updatedUser?._id) return;
        setUsers(prev => prev.map(u => (
            u._id === updatedUser._id
                ? { ...u, ...updatedUser, profilePicture: updatedUser.profilePicture || u.profilePicture }
                : u
        )));
    }

    // ── The user overlay ────────────────────────────────────────────────────
    // Mutation state for OTHER users, keyed by id — the counterpart of the card
    // overlay in CardsProvider. Starts empty and only fills with users you have
    // actually acted on.
    //
    // It exists because a follower count used to be derived by SCANNING the global
    // users array ("how many loaded users have this id in their following?"). With
    // that array gone, following someone has nowhere to record that their follower
    // count just went up — so the count would sit stale on every surface until a
    // refetch. Consumers read through the overlay first, then the user object's own
    // server-sent count.
    const [userOverlay, setUserOverlay] = useState({});

    const patchUser = (userId, patch) => {
        if (!userId) return;
        setUserOverlay(prev => ({
            ...prev,
            [userId]: { ...(prev[userId] || {}), ...patch },
        }));
    }

    const handleDeleteUser = async (userId) => {
        try{
            await deleteUser(userId);
            setUsers(users.filter(user => user._id !== userId))

            return{
                success: true,
                message: "User deleted successfully"
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

    const handleBanUser = async (userId) => {
        try{
            const response = await banUser(userId)
            setUsers(prev => prev.map((user) => {
                return user._id === userId ? response : user
            }))

            return{
                success: true,
                message: "User banned succefully"
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

    const handlePromoteUser = async (userId) => {
        try{
            const response = await promoteUser(userId);
            setUsers(prev => prev.map((user) => {
                return user._id === userId ? response : user;
            }))

            return{
                success: true,
                message: 'User becam admin successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

    // Fetch the users list once authenticated, and re-fetch on login.
    // On logout, drop the previous user's data so it isn't left in state.
    useEffect(() => {
        if(isLoggedIn){
            getUsers();
        } else {
            setUsers([]);
            setUserOverlay({});
        }
    }, [isLoggedIn])

    return(
        <UsersContext.Provider value={{
            users,
            loading,
            getUsers,
            syncUser,
            userOverlay,
            patchUser,
            handleDeleteUser,
            handleBanUser,
            handlePromoteUser
        }}>
            {children}
        </UsersContext.Provider>
    ) 
}

export function useUsersProvider(){
    return useContext(UsersContext);
}
