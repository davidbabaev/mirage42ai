import React from 'react'
import { Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import OnLoadingSkeletonBox from './OnLoadingSkeletonBox';

export default function ProtectedRoute({children}) {

    const {isLoggedIn, isUserLoaded} = useAuth();

    if(!isUserLoaded){
        return <OnLoadingSkeletonBox/>
    }


    if(isLoggedIn){
        // user logged in -> show the page
        return children
    }
    else{
        // if not logged in -> navigate to this page
        return <Navigate to={'/login'} />
    }
}
