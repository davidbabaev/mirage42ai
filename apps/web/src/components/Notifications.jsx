import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { useCardsProvider } from '../providers/CardsProvider';
import getTimeAgo from '../utils/getTimeAgo';
import { Avatar, Box, Button, IconButton, List, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import GavelIcon from '@mui/icons-material/Gavel';
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

          // Moderation notice: no actor (the moderator is intentionally hidden),
          // so it renders as a system message with a gavel icon and no profile link.
          const isSystem = notification.actionType === 'post-removed'

          const actionText = notification.actionType === 'follow'
          ? 'followed you'
          : notification.actionType === 'comment-like'
          ? 'liked your comment'
          : notification.actionType === 'comment-reply'
          ? 'replied to your comment'
          : isSystem
          ? 'Your post was removed for violating community guidelines.'
          : `${notification.actionType}d your post: ${notificationOnCard?.content.slice(0,40)}...`

          const primaryText = isSystem
          ? actionText
          : `${notificationSenderUser?.name} ${notificationSenderUser?.lastName} ${actionText}`

          return(
            <ListItem
              key={notification._id}
              sx={{
                px: 2,
                py: 1.5,
                cursor: isSystem ? 'default' : 'pointer',
                borderBottom: '0.5px solid',
                borderColor: 'divider',
                '&:last-child': {borderBottom: 'none'},
                '&:hover': {bgcolor: 'action.hover'}
              }}
              onClick={() => {
                if(isSystem) return // no moderator profile to open
                navigate(`/profiledashboard/${notificationSenderUser?._id}/profilemain`)
                onClose()
              }}
            >
              <ListItemAvatar sx={{maxWidth: 44}}
                onClick={() => { if(!isSystem) navigate(`/profiledashboard/${notificationSenderUser?._id}/profilemain`) }}
              >
                <Avatar
                  sx={{width: 36, height: 36, cursor: isSystem ? 'default' : 'pointer', bgcolor: isSystem ? 'error.main' : undefined}}
                  src={isSystem ? undefined : notificationSenderUser?.profilePicture}
                >
                  {isSystem && <GavelIcon sx={{fontSize: 18}}/>}
                </Avatar>
              </ListItemAvatar>

              <ListItemText
                primary={primaryText}
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
