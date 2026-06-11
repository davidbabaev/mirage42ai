import React from 'react'
import { useAuth } from '../providers/AuthProvider'
import { Avatar, Box, Container, Divider, Toolbar, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import Diversity1Icon from '@mui/icons-material/Diversity1';
import LogoutIcon from '@mui/icons-material/Logout';
import BookmarkIcon from '@mui/icons-material/Bookmark';

export default function ProfileSettingsPopup({onClose}) {

  const {user, handleLogout, isLoggedIn} = useAuth();
  const navigate = useNavigate();
  const onLogOut = () => {
    handleLogout();
    navigate('/login');
  }

  const profileDropdown = [
    {icon: <PersonIcon/>, label: 'Profile', action: () => navigate(`/profiledashboard/${user._id}/profilemain`)},
    {icon: <EditIcon/>, label: 'Profile Settings', action: () => navigate(`/dashboard/myprofile`)},
    {icon: <ManageAccountsIcon/>, label: 'Admin Dashboard', action: () => navigate(`/admindashboard/overviewpanel`), adminOnly: true},
    {icon: <FavoriteBorderIcon/>, label: 'Favorite Users', action: () => navigate(`/dashboard/myfavorites`)},
    {icon: <BookmarkIcon/>, label: 'Favorite Posts', action: () => navigate(`/dashboard/myfavoritescards`)},
    {icon: <LogoutIcon/>, label: 'Sign Out', action: () => onLogOut(), color: 'error.main'}
  ];

  return (
    <Box 
      sx={{
        position: 'absolute',
        top: '48px',
        right: 0,
        width: 240,
        bgcolor: 'background.paper',
        border: '0.5px solid',
        borderColor: 'divider',
        borderRadius: 2,
        zIndex: 1000,
        overflow: 'hidden'
      }}
    >
      <Box sx={{
            display:'flex', 
            alignItems: 'center', 
            gap: 1.5, 
            p: 2, 
            borderBottom: '0.5px solid', 
            borderColor: 'divider'
          }}>
          <Avatar src={user?.profilePicture}/>

          <Box>
            <Typography
              fontWeight={500}
              fontSize={14}
              color='text.primary'
            >
              {user?.name} {user?.lastName}
            </Typography>

            <Typography
              fontSize={12}
              color='text.secondary'
              >{user?.email}</Typography>
          </Box>

          <Divider/>  
      </Box>


        {profileDropdown.map((item, index) => {
          if(item.adminOnly && !user?.isAdmin) return null;
          return(
            <Box
                sx={{
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  color: item.color || 'text.primary',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
                key={index}
                onClick = {() => {
                  item.action();
                  onClose();
                }}
              >
                {item.icon}
                <Typography fontSize={14}>{item.label}</Typography>
            </Box>
          )
        })}
    </Box>
  )
}



