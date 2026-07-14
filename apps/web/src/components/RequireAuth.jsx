import React from 'react'
import { useAuth } from '../providers/authContext';
import OnLoadingSkeletonBox from './OnLoadingSkeletonBox';
import LoginWall from './LoginWall';

// Like ProtectedRoute, but instead of redirecting to /login it renders the
// LoginWall in place (URL preserved) for signed-out visitors. Use for public
// data pages that would otherwise show empty/broken UI when logged out.
export default function RequireAuth({children}) {
    const {isLoggedIn, isUserLoaded} = useAuth();

    if(!isUserLoaded){
        return <OnLoadingSkeletonBox/>
    }

    return isLoggedIn ? children : <LoginWall/>
}
