import React, { useEffect, useState } from 'react'
import { banUser, deleteUser, promoteUser} from "../services/apiService";
import { useAuth } from "./authContext";
import { UsersContext } from './usersContext';

// This provider used to load EVERY user in the database at app mount (GET /users)
// and hand the array to the whole app, which then answered questions like "who is
// this post's author?" and "how many followers does she have?" by scanning it.
// That is gone: each of those questions is now answered by the server, per request.
//
// What's left here is the user OVERLAY (mutation state for users you've acted on)
// and the admin mutations. There is no global users array any more.
export function UsersProvider({children}) {

    const {isLoggedIn} = useAuth();

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

    // The admin mutations. They no longer patch a local array — the admin panels are
    // server-paginated and refetch the current page after a mutation.
    const handleDeleteUser = async (userId) => {
        try{
            await deleteUser(userId);

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
            await banUser(userId)

            return{
                success: true,
                message: "User banned successfully"
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
            await promoteUser(userId);

            return{
                success: true,
                message: 'User became admin successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

    // Drop the previous user's mutation state on logout. (There is no users list to
    // fetch on login any more — that was the app-mount load of the entire user
    // collection, and it is gone.)
    useEffect(() => {
        if(!isLoggedIn) setUserOverlay({});
    }, [isLoggedIn])

    return(
        <UsersContext.Provider value={{
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

