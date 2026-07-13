import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { followUnfollowUser, blockUnblockUser, loginUser, registerUser, updateUser, getSingleUser, logout, FORCE_LOGOUT_EVENT } from '../services/apiService';
import { jwtDecode } from 'jwt-decode';
import { connectSocket, disconnectSocket } from '../services/socketService';
import { useNavigate } from 'react-router-dom';

const UseAuthCheck = createContext();

export function AuthProvider({children}) {

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);
    const [isUserLoaded , setIsUserLoaded] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const handleAuth = async () => {
            // NEW: check if google just redirected here with a token
            const params = new URLSearchParams(window.location.search);
            const googleToken = params.get('token')
    
            if(googleToken){
                // handle Google login
                localStorage.setItem('auth-token', googleToken);
                const decoded = jwtDecode(googleToken);
                const userGoogle = await getSingleUser(decoded.userId)
                setUser(userGoogle);

                setIsLoggedIn(true);
                connectSocket();
                window.history.replaceState({}, document.title, '/');
            }
            else{
                // existing code stays here exactly as it is
                const savedLoggedInUser = JSON.parse(localStorage.getItem('loggedInUser'))
                
                if(savedLoggedInUser){
                    setUser(savedLoggedInUser)
                    setIsLoggedIn(true) 
                    connectSocket();
                } else{
                    setIsLoggedIn(false) 
                }
            }
            setIsUserLoaded(true);
        }
        handleAuth();
    }, [])

    useEffect(() => {
        if(!isUserLoaded) return;
        localStorage.setItem('loggedInUser', JSON.stringify(user))
    }, [user, isUserLoaded])

    const handleRegister = async (user) => {
        try{
            const response = await registerUser(user);
            localStorage.setItem('auth-token', response.token);
            setUser(response.safeUser);
            setIsLoggedIn(true);
            connectSocket();

            return{
                success: true,
                message: 'registered successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }



    const handleLogin = async (email, password) => {
        try{
            const response = await loginUser({email, password});
            localStorage.setItem('auth-token', response.token)
            setUser(response.safeUser)
            setIsLoggedIn(true);
            connectSocket();

            return{
                success: true,
                message: 'Logged in successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

    // Mutation endpoints (follow, block, edit) answer with pickSafeUserFields,
    // which carries NO counts — so replacing `user` wholesale with the response
    // would silently wipe postsCount/followersCount off the logged-in user and
    // blank the own-profile counts. Merge instead: take the response's fields,
    // keep everything else we already know.
    const mergeIntoUser = (response) => {
        setUser(prev => (prev ? { ...prev, ...response } : response));
    };

    // Pull the logged-in user fresh from the server (GET /users/:id returns the
    // own record WITH postsCount / followersCount / followingCount). Used after an
    // action that changes one of those counts, so they stay live instead of being
    // frozen at whatever login handed us.
    const refreshMe = useCallback(async () => {
        const id = user?._id;
        if (!id) return;
        try {
            const fresh = await getSingleUser(id);
            setUser(prev => (prev ? { ...prev, ...fresh } : fresh));
        } catch (err) {
            // A stale count is not worth breaking the screen over.
            console.log(err.message);
        }
    }, [user?._id]);

    const handleToggleFollow = async (userId) => {
        try{
            const response = await followUnfollowUser(userId);
            mergeIntoUser(response)
            // Return the updated current user so callers can sync the users
            // list in place (no full re-fetch needed).
            return response
        }
        catch(err){
            console.log(err.message);
            return null
        }
    }

    // Toggle block/unblock. The server returns the updated current user (incl.
    // the refreshed `blocked` + `following`), which we store so the Block/Unblock
    // button and follow state reflect immediately.
    const handleToggleBlock = async (userId) => {
        try{
            const response = await blockUnblockUser(userId);
            mergeIntoUser(response)
            return response
        }
        catch(err){
            console.log(err.message);
            return null
        }
    }

    const handleLogout = () => {
        // Best-effort: revoke the refresh token + clear its cookie server-side.
        logout().catch(() => {});
        localStorage.removeItem('auth-token');
        setIsLoggedIn(false);
        setUser(null);
        // closes the scoket
        // (so the server forgets this user's conenction)
        disconnectSocket();
    }

    useEffect(() => {
        const handler = (event) => {
            const reason = event.detail.reason; // banned or deleted
            navigate(`/login?error=${reason}`)
            handleLogout();
        }

        window.addEventListener(FORCE_LOGOUT_EVENT, handler);
        return () => window.removeEventListener(FORCE_LOGOUT_EVENT, handler)
    }, [])

    const editUser = async (userId, updatedFields) => {
        try{
            const response = await updateUser(userId, updatedFields);
            mergeIntoUser(response);
            return{
                success: true,
                message: 'Edited Successfully'
            }
        }
        catch(err){
            return{
                success: false,
                message: err.message
            }
        }
    }

    
  return (
    <UseAuthCheck.Provider 
        value={{isLoggedIn, user, handleLogin, handleLogout, handleRegister, editUser, setUser, handleToggleFollow, handleToggleBlock, isUserLoaded, refreshMe}}>
            {children}
    </UseAuthCheck.Provider>
  )
}

export function useAuth(){
    return useContext(UseAuthCheck)
}
