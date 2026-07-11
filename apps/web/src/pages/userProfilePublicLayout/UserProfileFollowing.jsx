import React, { useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../providers/AuthProvider';
import useFollowUser from '../../hooks/useFollowUser';
import { Avatar, Box, Button, Paper, Typography } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import InfiniteScroll from '../../components/InfiniteScroll';
import { getFollowing } from '../../services/apiService';

export default function UserProfileFollowing() {

  const {id} = useParams();
  const {user} = useAuth();
  const {toggleFollow, isFollowByMe, getFollowersCount} = useFollowUser();
  const navigate = useNavigate();

  const profileId = id;

  const fetcher = useCallback(
    (cursor) => getFollowing(profileId, cursor, 15).then(r => ({ items: r.items ?? [], nextCursor: r.nextCursor ?? null })),
    [profileId]
  );

  const { items, hasMore, loading, loadingMore, error, refresh, loadMore } = useCursorPagination(fetcher);

  useEffect(() => {
    if (profileId) refresh();
  }, [profileId, refresh]);

  if (loading && items.length === 0) {
    return <OnLoadingSkeletonBox />;
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
          <Box sx={{ display: 'flex', textAlign: 'center', justifyContent: 'center', p: 2 }}>
            <Typography color='text.secondary'>Not following anyone yet</Typography>
          </Box>
        }
        showEnd={false}
      >
        <Box sx={{ p: 2, gap: {xs: 2, md: 0}, display: 'flex', flexDirection: {xs: 'column', md: 'row'}, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {items.map((following) => (
            <Box key={following?._id} sx={{
              display: 'flex',
              gap: 1.5,
              width: {xs: '100%', md:'48%'},
              alignItems: 'center',
              px: {xs: 0 ,md:1},
              pt: {xs: 0 ,md:1},
              pb: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              mx:{xs: 0, md:1},
            }}>
              <Avatar
                src={following?.profilePicture}
                sx={{cursor: 'pointer', width: 48, height: 48}}
                onClick={() => navigate(`/profiledashboard/${following?._id}/profilemain`)}
              />

              <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1}}>
                <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                  {following?.name} {following?.lastName}
                  <Typography
                    component='span'
                    color='text.secondary'
                    fontSize={11}
                    fontWeight={400}
                  >
                    {isFollowByMe(following?._id) && ' · following'}
                  </Typography>
                </Typography>

                <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                  {following?.job}
                </Typography>

                <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                  {getFollowersCount(following)} followers
                </Typography>
              </Box>

              {/* Right: Follow button */}
              {user && user._id !== following?._id && !isFollowByMe(following?._id) && (
                <Button
                  size='small'
                  variant={'outlined'}
                  startIcon={<PersonAddIcon/>}
                  onClick={async () => {
                    await toggleFollow(following?._id)
                  }}
                  sx={{
                    fontSize: 9,
                    borderRadius: 5,
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
  )
}
