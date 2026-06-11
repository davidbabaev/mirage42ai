import React, { createContext, useContext, useEffect, useState } from 'react'
import { banUser, deleteUser, getAllUsers, promoteUser} from "../services/apiService";

const UsersContext = createContext();

export function UsersProvider({children}) {

    // state and handlers go here
        const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)


    const getUsers = async () => {
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

    useEffect(() => {
        getUsers();
    }, [])
  
    return(
        <UsersContext.Provider value={{
            users, 
            loading, 
            getUsers, 
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
