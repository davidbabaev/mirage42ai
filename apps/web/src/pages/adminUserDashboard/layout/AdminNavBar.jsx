import { AppBar, Avatar, Badge, Box, Container, IconButton, Toolbar } from '@mui/material'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MirageLogo from '../../../assets/MirageLogo';
import ThemeMenu from '../../../components/ThemeMenu';
import { useAuth } from '../../../providers/AuthProvider';
import Notifications from '../../../components/Notifications';
import useNotifications from '../../../hooks/useNotifications';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ProfileSettingsPopup from '../../../components/ProfileSettingsPopup';
import MenuIcon from '@mui/icons-material/Menu';

export default function AdminNavBar({onToggle}) {

    const navigate = useNavigate();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isProfileAvaterOpen, setIsProfileAvaterOpen] = useState(false);
    const {user} = useAuth();

    const {
        notifications,
        handleDeleteNotification,
        unreadCount,
        handleMarkAsRead,
        refreshNotifications,
        loading: notificationsLoading,
        loadingMore: notificationsLoadingMore,
        hasMore: notificationsHasMore,
        error: notificationsError,
        loadMore: loadMoreNotifications,
    } = useNotifications();

    const ref = useRef(null);
    const profileRef = useRef(null);

    useEffect(() => {  
        const handler = (e) => {
            if(ref.current && !ref.current.contains(e.target)){
                setIsNotificationsOpen(false)
            }

            if(profileRef.current && !profileRef.current.contains(e.target)){
                setIsProfileAvaterOpen(false)
            }
        }
        document.addEventListener('mousedown', handler);

        return () => {
            document.removeEventListener('mousedown', handler);
        }
    }, [])

  return (
    <AppBar
        position='sticky'
        sx={{
            bgcolor: 'background.paper',
            boxShadow: 'none',
            borderBottom: '1px solid',
            borderColor: 'divider',
        }}
    >
        <Container maxWidth='100%'>
            <Toolbar disableGutters sx={{display: 'flex', justifyContent: 'space-between'}}>

            <Box sx={{display: 'flex', gap: 1, alignItems: 'center'}}>
                <IconButton onClick={onToggle}>
                    <MenuIcon/>
                </IconButton>
                
                <Box 
                    onClick={() => navigate('/')} 
                    sx={{cursor: 'pointer'}}
                >
                    <MirageLogo/>
                </Box>
            </Box>                

                {/* Right Features */}
                <Box sx={{display: 'flex', gap: 1}}>
                    <ThemeMenu/>

                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <Box ref={ref} style={{position: 'relative'}}>
                            <IconButton
                                onClick ={async() => {
                                setIsNotificationsOpen(!isNotificationsOpen)
                                if(!isNotificationsOpen){
                                    await handleMarkAsRead()
                                    await refreshNotifications()
                                }
                                }}
                            >
                                <Badge badgeContent={unreadCount}>
                                    <NotificationsIcon />
                                </Badge>
                            </IconButton>

                            {isNotificationsOpen && (
                                <Notifications
                                    countValue = {unreadCount}
                                    notificationsValue = {notifications}
                                    handleDeleteNotificationValue = {handleDeleteNotification}
                                    onClose={() => setIsNotificationsOpen(false)}
                                    loading={notificationsLoading}
                                    loadingMore={notificationsLoadingMore}
                                    hasMore={notificationsHasMore}
                                    error={notificationsError}
                                    onLoadMore={loadMoreNotifications}
                                />
                            )}
                        </Box>
                    </Box>
                    
                    <Box ref={profileRef} position={'relative'}>
                        <Avatar
                            sx={{cursor: 'pointer'}} 
                            src={user?.profilePicture}
                            onClick={() => setIsProfileAvaterOpen(!isProfileAvaterOpen)}
                            />

                        {isProfileAvaterOpen && (
                            <ProfileSettingsPopup/>
                        )}
                    </Box>
                </Box>
            </Toolbar>
        </Container>
    </AppBar>
  )
}
