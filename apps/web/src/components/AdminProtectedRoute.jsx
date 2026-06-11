import React from 'react'
import { useAuth } from '../providers/AuthProvider';
import { Navigate } from 'react-router-dom';
import OnLoadingSkeletonBox from './OnLoadingSkeletonBox';

export default function AdminProtectedRoute({children}) {
  
    const {isLoggedIn, isUserLoaded, user} = useAuth();

    if(!isUserLoaded){
        return <OnLoadingSkeletonBox/>
    }

    if(isLoggedIn && user.isAdmin){
        // user logged in -> show the page
        return children
    }
    else{
        // if not logged in -> navigate to this page
        return <Navigate to={'/dashboard/myprofile'} />
    }

}
