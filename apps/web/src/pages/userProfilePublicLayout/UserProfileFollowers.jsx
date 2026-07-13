import React, { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider';
import useFollowUser from '../../hooks/useFollowUser';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Avatar, Box, Button, Paper, Typography } from '@mui/material';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import InfiniteScroll from '../../components/InfiniteScroll';
import { getFollowers } from '../../services/apiService';
import { useProfileSubject } from './profileSubjectContext';


export default function UserProfileFollowers() {

  const {user} = useAuth();
  const {toggleFollow, isFollowByMe, getFollowersCount} = useFollowUser();
  const navigate = useNavigate();

  // Resolved once by UserProfileLayout (from the server) and shared via context.
  const currentUserProfile = useProfileSubject();
  const profileId = currentUserProfile?._id;

  const fetcher = useCallback(
    (cursor) => getFollowers(profileId, cursor, 15).then(r => ({ items: r.items ?? [], nextCursor: r.nextCursor ?? null })),
    [profileId]
  );

  const { items, hasMore, loading, loadingMore, error, refresh, loadMore } = useCursorPagination(fetcher);

  useEffect(() => {
    if (profileId) refresh();
  }, [profileId, refresh]);

  if (!currentUserProfile) {
    return <OnLoadingSkeletonBox/>;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        my: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
      }}
    >
      <InfiniteScroll
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={!!error}
        isEmpty={!loading && items.length === 0}
        onLoadMore={loadMore}
        onRetry={refresh}
        root={null}
        emptyState={
          <Box sx={{ display: 'flex', textAlign: 'center', justifyContent: 'center', width: '100%', py: 2 }}>
            <Typography color='text.secondary'>No followers yet</Typography>
          </Box>
        }
        showEnd={false}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: {xs: 2, md: 0},
            flexDirection: {xs: 'column', md: 'row'}
          }}
        >
          {items.map((follower) => (
            <Box
              key={follower._id}
              sx={{
                display: 'flex',
                gap: 1.5,
                width: {xs: '100%', md: '48%'},
                alignItems: 'center',
                px: {xs: 0, md: 1},
                pt: {xs: 0, md: 1},
                pb: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                mx: {xs: 0, md: 1},
              }}
            >
              <Avatar
                src={follower?.profilePicture}
                sx={{cursor: 'pointer', width: 48, height: 48}}
                onClick={() => navigate(`/profiledashboard/${follower?._id}/profilemain`)}
              />

              <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1}}>
                <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                  {follower?.name} {follower?.lastName}
                  <Typography
                    component='span'
                    color='text.secondary'
                    fontSize={11}
                    fontWeight={400}
                  >
                    {isFollowByMe(follower?._id) && ' · following'}
                  </Typography>
                </Typography>

                <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                  {follower?.job}
                </Typography>

                <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                  {getFollowersCount(follower)} followers
                </Typography>
              </Box>

              {/* Right: Follow button */}
              {user && user._id !== follower?._id && !isFollowByMe(follower?._id) && (
                <Button
                  size='small'
                  variant={'outlined'}
                  startIcon={<PersonAddIcon/>}
                  onClick={async () => {
                    await toggleFollow(follower);
                  }}
                  sx={{
                    fontSize: 9,
                    borderRadius: 5,
                    // '& .MuiButton-startIcon' : {mb: 0.2}
                  }}
                >
                  Follow
                </Button>
              )}
            </Box>
          ))}
        </Box>
      </InfiniteScroll>
    </Paper>
  );
}
