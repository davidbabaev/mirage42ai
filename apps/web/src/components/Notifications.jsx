import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { useCardsProvider } from '../providers/CardsProvider';
import getTimeAgo from '../utils/getTimeAgo';
import { Avatar, Box, Button, IconButton, List, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useUsersProvider } from '../providers/UsersProvider';


export default function Notifications({
  notificationsValue, 
  handleDeleteNotificationValue,
  onClose
}) {

  const {users} = useUsersProvider();
  const navigate = useNavigate();
  const {registeredCards} = useCardsProvider();

  const [countNotifications, setCountNotifications] = useState(6)

  const countedListNotifcations = notificationsValue.slice(0, countNotifications)

  if(!notificationsValue || !users) return <p>Loading..</p>

  return (
    <Box sx={{
      position: {xs: 'fixed',md:'absolute'},
      top: {xs: 56, md: '48px'},
      left: {xs: 0, md: 'auto'},
      right: 0,
      bottom: {xs: 0, md: 'auto'},
      width: {xs:'100%', md:380},
      maxHeight: {xs:'100dvh', md: 400},
      overflow: 'auto',
      overscrollBehavior: 'contain',
      bgcolor: 'background.paper',
      border: {xs: 'none', md: '1px solid'},
      borderRadius: {xs: 0, md: 2},
      // border: '1px solid',
      borderColor: 'divider',
      zIndex: 100,
    }}>
      <Box sx={{
        px: 2,
        py: 1.5, 
        borderBottom: '0.5px solid',
        borderColor: 'divider'
      }}>
        <Typography 
          sx={{
            fontWeight: 600,
            fontSize: 14,
            color: 'text.primary'
          }}>
          Notifications
        </Typography>
      </Box>

      <List disablePadding>
        {countedListNotifcations.map((notification) => {
          const notificationSenderUser = users.find(u => u._id === notification.fromUser)
          const notificationOnCard = registeredCards.find(c => c._id === notification.whichCard)

          const actionText = notification.actionType === 'follow' 
          ? 'followed you'
          : `${notification.actionType}d your post: ${notificationOnCard?.content.slice(0,40)}...`

          return(
            <ListItem 
              key={notification._id}
              sx={{
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                borderBottom: '0.5px solid',
                borderColor: 'divider',
                '&:last-child': {borderBottom: 'none'},
                '&:hover': {bgcolor: 'action.hover'}
              }}
              onClick={() => {
                navigate(`/profiledashboard/${notificationSenderUser?._id}/profilemain`)
                onClose()
              }}
            >
              <ListItemAvatar sx={{maxWidth: 44}}
                onClick={() => navigate(`/profiledashboard/${notificationSenderUser?._id}/profilemain`)}
              >
                <Avatar 
                  sx={{width: 36, height: 36, cursor: 'pointer'}}
                  src={notificationSenderUser?.profilePicture}
                />
              </ListItemAvatar>

              <ListItemText
                primary={`${notificationSenderUser?.name} ${notificationSenderUser?.lastName} ${actionText}`}
                secondary={getTimeAgo(notification.createdAt)}
                slotProps={{
                  primary:{
                    fontSize: 13,
                    color: 'text.primary',
                    fontWeight: 500,
                  },
                  secondary: {
                    fontSize: 11,
                    color: 'text.secondary'
                  }
                }}
              />

              <IconButton
                sx={{color: 'text.disabled', '&:hover' : {color: 'error.main'}}}
                onClick={() => handleDeleteNotificationValue(notification._id)}
              >
                <DeleteIcon fontSize='small'/>
              </IconButton>

            </ListItem>
          )
        })}

        {notificationsValue.length > countNotifications && (
          <Button 
            variant='outlined' 
            sx={{m:2, fontSize: 11, borderRadius: 5}} 
            size='small'
            startIcon={<KeyboardArrowDownIcon/>}
            onClick={() => setCountNotifications(countNotifications + 6)}
          >
              More..
            </Button>
        )}
      </List>
    </Box>
  )
}
