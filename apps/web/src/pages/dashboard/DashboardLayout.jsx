import React, { useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import SelectedPage from './SelectedPage'
import ProfileSection from './ProfileSection'
import MyCardsSection from './MyCardsSection'
import FavoriteCards from './FavoriteCards'
import useFollowUser from '../../hooks/useFollowUser'
import { useAuth } from '../../providers/AuthProvider'
import { useCardsProvider } from '../../providers/CardsProvider'
import { Avatar, Box, Button, Container, IconButton, Paper, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ConfirmationDialog from '../../components/ConfirmationDialog'
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox'
import { useUsersProvider } from '../../providers/UsersProvider'

export default function DashboardLayout() {

    const {user, handleLogout} = useAuth();
    const {handleDeleteUser, getUsers} = useUsersProvider();  
    const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const navigate = useNavigate();

    const onLogOut = () => {
        handleLogout();
        navigate('/login');
    }
      

    const {getFollowersCount} = useFollowUser();
    const {registeredCards, refreshFeed, fetchCards} = useCardsProvider();
    const postsAmount = registeredCards.filter((card) => card.userId === user._id).length

    if(!user){
        return <OnLoadingSkeletonBox/>
    }

    return (
        <Container maxWidth='lg'>

            <Paper
                elevation={0}
                sx={{
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    my:2,
                    borderRadius: 4,
                }}
            >
                {/* Cover Image */}
                <Box
                    sx={{
                        width: '100%',
                        height: {xs: 100,md: 230},
                        borderRadius: 4,
                        backgroundImage: `url(${user?.coverImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}       
                />

                <Box 
                    sx={{
                        mb:1,
                        display: 'flex',
                    }} 
                    onClick={() => navigate(`/profiledashboard/${user?._id}/following`)}
                >
                    <Avatar
                        src={user?.profilePicture}
                        sx={{
                            mt: {xs: '-30px',md: '-100px'}, 
                            width: {xs: 80,md: 180},
                            height: {xs: 80,md: 180},
                            mx:{xs: 1, md:3},
                            borderStyle: 'solid',
                            borderWidth: {xs: 2, md: 4},
                            borderColor: 'background.paper',
                            cursor: 'pointer',
                        }}
                    />
                    
                    {/* mobile stats and name */}
                    <Box
                        sx={{
                            display:{xs: 'flex', md: 'none'},
                            flexDirection: 'column',
                            gap: 0.5,
                            justifyContent: 'center',
                        }} 
                    >
                        <Typography fontWeight={600} fontSize={18} sx={{cursor: 'pointer', mb: -0.5}}
                            onClick={() => navigate(`/profiledashboard/${user?._id}/profilemain`)}
                        >
                            {user?.name} {user?.lastName}
                        </Typography>  

                            <Box sx={{display: 'flex', gap: 1}}>
                                <Typography fontSize={13}><b>{getFollowersCount(user?._id)}</b> <Typography component="span" color="text.secondary" fontSize={13}>followers</Typography></Typography>
                                <Typography fontSize={13}><b>{(user?.following || []).length}</b> <Typography component="span" color="text.secondary" fontSize={13}>following</Typography></Typography>
                                <Typography fontSize={13}><b>{postsAmount}</b> <Typography component="span" color="text.secondary" fontSize={13}>posts</Typography></Typography>
                            </Box>
                    </Box>



                    {/* Stats row */}
                    <Box sx={{
                        width: '100%',
                        display: {xs: 'none',md:'flex'},
                        justifyContent: 'start',
                        gap: 3,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        mr: 2
                    }}>
                        <Box 
                            textAlign='center'
                            onClick={() => navigate(`/profiledashboard/${user?._id}/followers`)}
                            sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                gap: 0.5,
                                alignItems: 'center',
                            }}
                        >
                            <Typography 
                                fontWeight={600}
                                fontSize={16}
                            >
                                {getFollowersCount(user?._id)}
                            </Typography>

                            <Typography 
                                fontSize={16}
                                color='text.secondary'
                            >
                                followers
                            </Typography>
                        </Box>

                        <Box 
                            textAlign='center'
                            onClick={() => navigate(`/profiledashboard/${user?._id}/following`)}
                            sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                gap: 0.5,
                                alignItems: 'center',
                            }}
                        >
                            <Typography 
                                fontWeight={600}
                                fontSize={16}
                            >
                                {(user?.following || []).length}
                            </Typography>

                            <Typography 
                                fontSize={16}
                                color='text.secondary'
                            >
                                following
                            </Typography>
                        </Box>

                        <Box 
                            textAlign='center'
                            onClick={() => navigate(`/profiledashboard/${user?._id}/profilemain`)}
                            sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                gap: 0.5,
                                alignItems: 'center',
                            }}
                        >
                            <Typography 
                                fontWeight={600}
                                fontSize={16}
                            >
                                {postsAmount}
                            </Typography>

                            <Typography 
                                fontSize={16}
                                color='text.secondary'
                            >
                                posts
                            </Typography>
                        </Box>
                    </Box>

                </Box>
                
                <Box sx={{display: 'flex', justifyContent: 'space-between', pr:2 }}>
                    {/* Name, Job, Location */}
                    <Box sx={{mx: {xs: 1,md:3}, px:1, pb:1}}>
                        <Typography 
                            display={{xs: 'none', md: 'block'}}
                            fontWeight={600} 
                            fontSize={25}
                            onClick={() => navigate(`/profiledashboard/${user?._id}/profilemain`)}
                            sx={{cursor: 'pointer'}}
                        >
                            {user?.name} {user?.lastName}
                        </Typography>

                        <Typography 
                            fontSize={13} 
                            color='text.secondaty' 
                            sx={{mb: -0.5}}
                        >
                            {user?.job}
                        </Typography>

                        <Typography fontSize={12} color='text.disabled'>
                            {user?.address.country}, {user?.address.city}
                        </Typography>
                    </Box>
                    
                    <Box sx={{display: {xs: 'none',md:'flex'}, gap: 1, alignItems: 'center'}}>

                        <Tooltip title="View your public profile">
                            <IconButton 
                                size='small'
                                onClick={() => navigate(`/profiledashboard/${user._id}/profilemain`)}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    px: 1.4, 
                                    py:1.4,
                                    bgcolor: 'background.paper',
                                    color: 'text.secondary',
                                    // '&:hover':{
                                    //     bgcolor: 'action.hover',
                                    //     borderColor: 'primary.main',
                                    //     color: 'primary.main'
                                    // }
                                }}
                            >
                                <RemoveRedEyeIcon sx={{fontSize: 15}}/>
                            </IconButton>
                        </Tooltip>

                        {editMode === false && (
                            <Button 
                                variant='contained'
                                size='small'
                                sx={{borderRadius: 5, px: 2, py:1, fontSize: 12}}
                                endIcon={<EditIcon/>}
                                onClick={() => navigate(`/dashboard/myprofile`, { state: {editMode: true} })}
                                
                            >
                                Edit Profile
                            </Button>
                        )}
                        
                        {!user.isAdmin && (
                            <Button 
                                variant='outlined'
                                color='error'
                                size='small'
                                sx={{borderRadius: 5, px: 2, py:1, fontSize: 12}}
                                endIcon={<DeleteIcon/>}
                                onClick={() => setConfirmDeleteUser(user)}
                            >
                                Delete Profile
                            </Button>
                        )}
                    </Box>
                </Box>

                <Box sx={{display: {xs: 'flex',md:'none'}, gap: 1, px:1, pb:1 ,alignItems: 'center'}}>

                    <Tooltip title="View your public profile">
                        <IconButton 
                            size='small'
                            onClick={() => navigate(`/profiledashboard/${user._id}/profilemain`)}
                            sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                px: 1.4, 
                                py:1.4,
                                bgcolor: 'background.paper',
                                color: 'text.secondary',
                                // '&:hover':{
                                //     bgcolor: 'action.hover',
                                //     borderColor: 'primary.main',
                                //     color: 'primary.main'
                                // }
                            }}
                        >
                            <RemoveRedEyeIcon sx={{fontSize: 15}}/>
                        </IconButton>
                    </Tooltip>

                    {editMode === false && (
                        <Button 
                            variant='contained'
                            size='small'
                            sx={{borderRadius: 5, px: 1, py:1, fontSize: 10}}
                            endIcon={<EditIcon/>}
                            onClick={() => navigate(`/dashboard/myprofile`, { state: {editMode: true} })}
                            
                        >
                            Edit Profile
                        </Button>
                    )}
                    
                    {!user.isAdmin && (
                        <Button 
                            variant='outlined'
                            color='error'
                            size='small'
                            sx={{borderRadius: 5, px: 2, py:1, fontSize: 10}}
                            endIcon={<DeleteIcon/>}
                            onClick={() => setConfirmDeleteUser(user)}
                        >
                            Delete Profile
                        </Button>
                    )}
                </Box>
        
            </Paper>

            <Tabs sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
            }}
                value={location.pathname}
                variant='scrollable'
                scrollButtons={false}
            >
                <Tab 
                    sx={{fontSize: {xs: 11, md: 14}}}
                    label='Profile' 
                    value='/dashboard/myprofile'
                    onClick={() => navigate('/dashboard/myprofile')}
                    />

                <Tab 
                    sx={{fontSize: {xs: 11, md: 14}}}
                    label='My Posts'
                    value='/dashboard/mycards'
                    onClick={() => navigate('/dashboard/mycards')}
                    />

                <Tab 
                    sx={{fontSize: {xs: 11, md: 14}}}
                    label='Favorite Users' 
                    value='/dashboard/myfavorites'
                    onClick={() => navigate('/dashboard/myfavorites')}
                    />

                <Tab 
                    sx={{fontSize: {xs: 11, md: 14}}}
                    label='Favorite Posts' 
                    value='/dashboard/myfavoritescards'
                    onClick={() => navigate('/dashboard/myfavoritescards')}
                />
            </Tabs>

            <Routes>
                <Route path='/myprofile' element={<ProfileSection
                    editMode = {editMode} // flase by default
                    onEditMode={() => setEditMode(true)}
                    onCloseEdit={() => setEditMode(false)}
                />}/>
                <Route path='/mycards' element={<MyCardsSection/>}/>
                <Route path='/myfavorites' element={<SelectedPage/>}/>
                <Route path='/myfavoritescards' element={<FavoriteCards/>}/>
            </Routes>

            {confirmDeleteUser && (
                <ConfirmationDialog
                    message={`Delete user ${confirmDeleteUser.name} ${confirmDeleteUser.lastName}?`}
                    onClose={() => setConfirmDeleteUser(null)}
                    onConfirm={async () => {
                        await handleDeleteUser(confirmDeleteUser._id);
                        await getUsers();
                        await fetchCards();
                        await refreshFeed();
                        setConfirmDeleteUser(null);
                        onLogOut();
                    }}
                />
            )}
        </Container>
    )
}
