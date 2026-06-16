import React, { createContext, useContext, useEffect, useState } from 'react'
import { followUnfollowUser, loginUser, registerUser, updateUser, getSingleUser, logout, FORCE_LOGOUT_EVENT } from '../services/apiService';
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

    const handleToggleFollow = async (userId) => {
        try{
            const response = await followUnfollowUser(userId);
            setUser(response)
            // Return the updated current user so callers can sync the users
            // list in place (no full re-fetch needed).
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
            setUser(response);
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
        value={{isLoggedIn, user, handleLogin, handleLogout, handleRegister, editUser, setUser, handleToggleFollow, isUserLoaded}}>
            {children}
    </UseAuthCheck.Provider>
  )
}

export function useAuth(){
    return useContext(UseAuthCheck)
}
