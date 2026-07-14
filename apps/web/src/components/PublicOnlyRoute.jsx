import React from 'react'
import { useAuth } from '../providers/authContext'
import { Navigate } from 'react-router-dom'
import OnLoadingSkeletonBox from './OnLoadingSkeletonBox'

export default function PublicOnlyRoute({children}) {
  
    const {isLoggedIn, isUserLoaded} = useAuth()

    if(!isUserLoaded){
        return <OnLoadingSkeletonBox/>
    }

    if(isLoggedIn){
        return <Navigate to={'/'}/>
    }
    else{
        return children
    }
}
