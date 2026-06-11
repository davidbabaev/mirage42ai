import { useThemeContext } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import useNotifications from '../hooks/useNotifications';
import Notifications from './Notifications';
import { AppBar, Avatar, Badge, Box, Button, Container, IconButton, Toolbar, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home'
import ExploreIcon from '@mui/icons-material/Explore'
import PeopleIcon from '@mui/icons-material/People'
import AddBoxIcon from '@mui/icons-material/AddBox';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ProfileSettingsPopup from './ProfileSettingsPopup';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import CreateCardModal from './CreateCardModal';
import MirageLogo from '../assets/MirageLogo';
import MessageIcon from '@mui/icons-material/Message';
import { useUI } from '../providers/UIProvider';

export default function NavBar() {

    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isProfileAvaterOpen, setIsProfileAvaterOpen] = useState(false);
    const {darkMode, handleToggle} = useThemeContext();
    const {isLoggedIn, user} = useAuth();
    const ref = useRef(null);
    const profileRef = useRef(null);
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const {setIsChatOpen, isChatOpen} = useUI();
    

    // mobile scroll logic:
    const [isBottomBarVisible, setIsBottomBarVisible] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const scrollContainer = document.getElementById('app-scroll-container');
        if(!scrollContainer) return;

        const handleScroll = () => {
            const currentScrollY = scrollContainer.scrollTop;

            if(currentScrollY > lastScrollY.current && currentScrollY > 50){
                setIsBottomBarVisible(false);
            }
            else{
                setIsBottomBarVisible(true);
            }

            lastScrollY.current = currentScrollY;
        };

        scrollContainer.addEventListener('scroll', handleScroll);
        return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }, []);

    

    const {
        notifications,
        handleDeleteNotification,
        unreadCount,
        handleMarkAsRead
      } = useNotifications();

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

    const navLinkSx = (path) => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        px: 2,
        py: 1,
        color: location.pathname === path ? 'primary.main' : 'text.secondary',
        borderBottom: location.pathname === path ? '2px solid' : '2px solid transparent',
        borderColor: location.pathname === path ? 'primary.main' : 'transparent',
    })




  return (
<>
    <AppBar 
        position='sticky'
        sx={{
            display: {xs: isChatOpen ? 'none' : 'flex', md: 'flex'},
            bgcolor: 'background.paper',
            boxShadow: 'none',
            borderBottom: '1px solid',
            borderColor: 'divider',
            zIndex: 500
            
        }}
    >
        <Container maxWidth='lg'>
            <Toolbar disableGutters>
                <Box 
                    onClick={() => navigate('/')} 
                    sx={{cursor: 'pointer'}}
                >
                    <MirageLogo/>
                </Box>

                <Box 
                    sx={{display: {xs: 'none', md: 'flex'}, flex: '1', justifyContent: 'center'}}
                >
                    <Box
                        onClick={() => navigate('/')}
                        sx={navLinkSx('/')}
                        >
                        <HomeIcon fontSize='small'/>
                        <Typography variant='caption'>Feed</Typography>
                    </Box>

                    <Box
                        onClick={() => navigate('/allusers')}
                        sx={navLinkSx('/allusers')}
                        >
                        <PeopleIcon fontSize='small'/>
                        <Typography variant='caption'>Users</Typography>
                    </Box>

                    {isLoggedIn && (
                        <Box
                            sx={navLinkSx('/createnewcard')}
                            onClick={() => setIsModalOpen(true)}
                        >
                            <AddBoxIcon fontSize='small'/>
                            <Typography 
                                variant='caption'
                            >
                                Add Post
                            </Typography>
                        </Box>
                    )}

                    <Box
                        onClick={() => navigate('/allcards')}
                        sx={navLinkSx('/allcards')}
                        >
                        <ExploreIcon fontSize='small'/>
                        <Typography variant='caption'>Explore Posts</Typography>
                    </Box>

                    {isLoggedIn && (
                        <Box
                            onClick={() => navigate('/chat')}
                            sx={navLinkSx('/chat')}
                            >
                            <MessageIcon fontSize='small'/>
                            <Typography variant='caption'>Messages</Typography>
                        </Box>
                    )}

                </Box>

                {isModalOpen && (
                    <CreateCardModal
                        // onCardPosted={() => refreshFeed()}
                        onClose={() => setIsModalOpen(false)}
                        // mediaButton={mediaType}
                    />
                )}

                <Box
                    onClick={() => handleToggle()}
                    sx={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'text.secondary',
                        ml: 'auto',
                        '&:hover': {
                            color: 'text.primary'
                        }
                    }}
                >
                    {
                        darkMode ? (
                            <LightModeIcon/>
                        ) : (
                            <DarkModeIcon/>
                        )
                    }
                </Box>

                {isLoggedIn ? (
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                            <Box ref={ref} style={{position: 'relative'}}>
                                <IconButton
                                    onClick ={async() => {
                                    setIsNotificationsOpen(!isNotificationsOpen)
                                    if(!isNotificationsOpen){
                                        await handleMarkAsRead()   
                                    }
                                    }} 
                                >
                                    <Badge 
                                        badgeContent={unreadCount}
                                        color='error'
                                        sx={{
                                            '& .MuiBadge-badge':{
                                                fontSize: 10,
                                                height: 18,
                                                minWidth: 18
                                            }
                                        }}
                                    >
                                        <NotificationsIcon/>
                                    </Badge>
                                </IconButton>

                                {isNotificationsOpen && (
                                    <Notifications 
                                        countValue = {unreadCount}
                                        notificationsValue = {notifications}
                                        handleDeleteNotificationValue = {handleDeleteNotification}
                                        onClose={() => setIsNotificationsOpen(false)}
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
                                <ProfileSettingsPopup
                                    onClose = {() => setIsProfileAvaterOpen(false)}
                                />
                            )}
                        </Box>
                    </Box>
                ): (
                    <Box sx={{display: 'flex', gap:1, ml: 1}}>
                        <Button 
                            variant="outlined" 
                            onClick={() => navigate('/login')}
                            size='small'
                            sx={{borderRadius: 5, fontSize: 12, px: 2}}
                        >
                            login
                        </Button>
                        <Button 
                            variant="contained" 
                            onClick={() => navigate('/registered')}
                            size='small'
                            sx={{borderRadius: 5, fontSize: 12, px: 2}}
                        >
                            Register
                        </Button>
                    </Box>
                )}


            </Toolbar>
        </Container>

    </AppBar>

    {/* Mobile Bottom navbar */}
    <Box
        position={'fixed'}
        sx={{
            bgcolor: 'background.paper',
            boxShadow: 'none',
            borderBottom: '1px solid',
            borderColor: 'divider',
            zIndex: 100,
            bottom: 0,
            width:'100%',
            px: 2,
            display: {xs: isChatOpen ? 'none' : 'flex', md: 'none'},
            transform: isBottomBarVisible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s ease'
        }}
    >
        <Box 
            sx={{display: 'flex', flex: '1', justifyContent: 'space-between'}}
        >
            <Box
                onClick={() => navigate('/')}
                sx={navLinkSx('/')}
                >
                <HomeIcon fontSize='small'/>
                <Typography variant='caption'>Feed</Typography>
            </Box>

            <Box
                onClick={() => navigate('/allusers')}
                sx={navLinkSx('/allusers')}
                >
                <PeopleIcon fontSize='small'/>
                <Typography variant='caption'>Users</Typography>
            </Box>

            {isLoggedIn && (
                <Box
                    sx={navLinkSx('/createnewcard')}
                    onClick={() => setIsModalOpen(true)}
                >
                    <AddBoxIcon fontSize='small'/>
                    <Typography 
                        variant='caption'
                    >
                        Create
                    </Typography>
                </Box>
            )}

            <Box
                onClick={() => navigate('/allcards')}
                sx={navLinkSx('/allcards')}
                >
                <ExploreIcon fontSize='small'/>
                <Typography variant='caption'>Posts</Typography>
            </Box>

            {isLoggedIn && (
                <Box
                    onClick={() => navigate('/chat')}
                    sx={navLinkSx('/chat')}
                    // onClick={() => setIsModalOpen(true)}
                >
                    <MessageIcon fontSize='small'/>
                    <Typography 
                        variant='caption'
                    >
                        Messages
                    </Typography>
                </Box>
            )}
        </Box>
    </Box>

    </>
  )
}
