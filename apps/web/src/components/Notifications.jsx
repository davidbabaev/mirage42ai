import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import getTimeAgo from '../utils/getTimeAgo';
import { Avatar, Box, IconButton, List, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import GavelIcon from '@mui/icons-material/Gavel';
import { useUsersProvider } from '../providers/UsersProvider';
import InfiniteScroll from './InfiniteScroll';


export default function Notifications({
  notificationsValue,
  handleDeleteNotificationValue,
  onClose,
  loading,
  loadingMore,
  hasMore,
  error,
  onLoadMore,
}) {

  const {users} = useUsersProvider();
  const navigate = useNavigate();

  // The scroll container becomes the IntersectionObserver root so the sentinel
  // fires against the panel's own overflow, not the window.
  const [scrollEl, setScrollEl] = useState(null);

  if(!notificationsValue || !users) return <p>Loading..</p>

  return (
    <Box ref={setScrollEl} sx={{
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

      <InfiniteScroll
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={!!error}
        isEmpty={!loading && notificationsValue.length === 0}
        onLoadMore={onLoadMore}
        onRetry={onLoadMore}
        root={scrollEl}
        showEnd={false}
        emptyState={
          <Box sx={{ textAlign: 'center', py: 5, px: 2, color: 'text.secondary' }}>
            <Typography variant="body2">No notifications yet.</Typography>
          </Box>
        }
      >
      <List disablePadding>
        {notificationsValue.map((notification) => {
          const notificationSenderUser = users.find(u => u._id === notification.fromUser)

          // Moderation notice: no actor (the moderator is intentionally hidden),
          // so it renders as a system message with a gavel icon and no profile link.
          const isSystem = notification.actionType === 'post-removed'
          const actionType = notification.actionType

          // Build the deep-link URL for this notification:
          // - follow             → sender's profile page
          // - like / comment     → the post modal
          // - comment-like / comment-reply → the post modal + comment anchor
          // - post-removed       → /allcards (post is banned; attempting to open it
          //                        would show a stuck skeleton for non-admins since
          //                        banned cards are excluded from registeredCards)
          const buildNavigationTarget = () => {
              if (actionType === 'follow') {
                  return `/profiledashboard/${notificationSenderUser?._id}/profilemain`
              }
              if (actionType === 'like' || actionType === 'comment') {
                  return `/allcards?card=${notification.whichCard}`
              }
              if (actionType === 'comment-like' || actionType === 'comment-reply') {
                  return notification.commentId
                      ? `/allcards?card=${notification.whichCard}&comment=${notification.commentId}`
                      : `/allcards?card=${notification.whichCard}`
              }
              if (actionType === 'post-removed') {
                  return '/allcards'
              }
              if (actionType === 'post-reported') {
                  return `/allcards?card=${notification.whichCard}`
              }
              return `/profiledashboard/${notificationSenderUser?._id}/profilemain`
          }

          const actionText = notification.actionType === 'follow'
          ? 'followed you'
          : notification.actionType === 'like'
          ? 'liked your post'
          : notification.actionType === 'comment'
          ? 'commented on your post'
          : notification.actionType === 'comment-like'
          ? 'liked your comment'
          : notification.actionType === 'comment-reply'
          ? 'replied to your comment'
          : notification.actionType === 'post-reported'
          ? 'reported a post'
          : isSystem
          ? 'Your post was removed for violating community guidelines.'
          : `${notification.actionType}d your post`

          const primaryText = isSystem
          ? actionText
          : `${notificationSenderUser?.name} ${notificationSenderUser?.lastName} ${actionText}`

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
                navigate(buildNavigationTarget())
                onClose()
              }}
            >
              <ListItemAvatar sx={{maxWidth: 44}}
                onClick={(e) => {
                  // Avatar always links to the sender's profile (except system notifications
                  // which have no actor). Stop propagation so the row's deep-link doesn't fire.
                  if (!isSystem) {
                    e.stopPropagation()
                    navigate(`/profiledashboard/${notificationSenderUser?._id}/profilemain`)
                    onClose()
                  }
                }}
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
                onClick={(e) => { e.stopPropagation(); handleDeleteNotificationValue(notification._id); }}
              >
                <DeleteIcon fontSize='small'/>
              </IconButton>

            </ListItem>
          )
        })}
      </List>
      </InfiniteScroll>
    </Box>
  )
}
