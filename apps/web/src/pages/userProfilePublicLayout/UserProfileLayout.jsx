import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import useFollowUser from '../../hooks/useFollowUser';
import UserProfileAbout from './UserProfileAbout';
import UserProfileMain from './UserProfileMain';
import { useAuth } from '../../providers/AuthProvider';
import UserProfileFollowing from './UserProfileFollowing';
import UserProfileFollowers from './UserProfileFollowers';
import { useCardsProvider } from '../../providers/CardsProvider';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckIcon from '@mui/icons-material/Check';
import { Avatar, Box, Button, Container, IconButton, Paper, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import useSelectedUsers from '../../hooks/useSelectedUsers';
import ChatIcon from '@mui/icons-material/Chat';
import { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import UserProfileMedia from './UserProfileMedia';
import LoginPopup from '../../components/LoginPopup';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';

export default function UserProfileLayout() {

    const {id} = useParams();
    const{users} = useUsersProvider();
    const {user, isLoggedIn} = useAuth();
    const {refreshFeed, registeredCards} = useCardsProvider();
    const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
    function onCloseLoginPopup(){
        setIsLoginPopupOpen(false)
    }
    
    const {toggleFollow, isFollowByMe, getFollowingCount, getFollowersCount} = useFollowUser();
    const {selectedUsers ,selectHandleUser} = useSelectedUsers();
    const [messageOpen, setMessageOpen] = useState(false)

    useEffect(() => {
      if(messageOpen){
        document.body.style.overflow = 'hidden'
        return () => {
        document.body.style.overflow = 'unset'
        }
      }
    }, [messageOpen])

    
    const userProfile = users.find(u => u._id === id);
    
    const mystyle = {marginRight: '8px'};
    const navigate = useNavigate();

    const postsAmount = registeredCards.filter((card) => card.userId === id).length
    
    if(!userProfile){
        return <OnLoadingSkeletonBox/>
    }

  return (

    <Container maxWidth='lg'>
      <Paper
          elevation={0}
          sx={{
              overflow: 'hidden',
              bgcolor: 'background.paper',
              mt:2,
              borderRadius: 4,
          }}
      >
          {/* Cover Image */}
          <Box
              sx={{
                  width: '100%',
                  height: {xs: 100,md: 230},
                  borderRadius: 4,
                  backgroundImage: `url(${userProfile?.coverImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
              }}       
          />

          <Box 
              sx={{
                  mb:1,
                  display: 'flex',
              }} 
            //   onClick={() => navigate(`/profiledashboard/${userProfile?._id}/following`)}
          >
              <Avatar
                  src={userProfile?.profilePicture}
                  sx={{
                      mt: {xs: '-30px',md: '-100px'}, 
                      width: {xs: 80,md: 180},
                      height: {xs: 80,md: 180},
                      mx:{xs: 1, md:3},
                      borderStyle: 'solid',
                      borderWidth: {xs: 2, md: 4},
                      borderColor: 'background.paper',
                  }}
              />
                {/* mobile stats */}
              <Box 
                display={{xs: 'flex', md: 'none'}} 
                sx={{
                    flexDirection: 'column',
                    gap: 0.5,
                    justifyContent: 'center'
                }}>
                <Typography 
                        fontWeight={600} 
                        fontSize={18}
                        onClick={() => navigate(`/profiledashboard/${userProfile?._id}/profilemain`)}
                        sx={{cursor: 'pointer', mb: -0.5}}
                  >
                      {userProfile?.name} {userProfile?.lastName}
                  </Typography>

                {/* Stats row */}
                <Box sx={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'start',
                    gap: {xs: 1,md: 3},
                    // borderBottom: '1px solid',
                    // borderColor: 'divider',
                    mr: 2
                }}>
                    <Box 
                        textAlign='center'
                        onClick={() => navigate(`/profiledashboard/${userProfile?._id}/followers`)}
                        sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            gap: 0.5,
                            alignItems: 'center',
                        }}
                    >
                        <Typography 
                            fontWeight={600}
                            fontSize={{xs: 13, md:16}}
                        >
                            {getFollowersCount(userProfile?._id)}
                        </Typography>

                        <Typography 
                            fontSize={{xs: 13, md:16}}
                            color='text.secondary'
                        >
                            followers
                        </Typography>
                    </Box>

                    <Box 
                        textAlign='center'
                        onClick={() => navigate(`/profiledashboard/${userProfile?._id}/following`)}
                        sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            gap: 0.5,
                            alignItems: 'center',
                        }}
                    >
                        <Typography 
                            fontWeight={600}
                            fontSize={{xs: 13, md:16}}
                        >
                            {(userProfile?.following || []).length}
                        </Typography>

                        <Typography 
                            fontSize={{xs: 13, md:16}}
                            color='text.secondary'
                        >
                            following
                        </Typography>
                    </Box>

                    <Box 
                        textAlign='center'
                        onClick={() => navigate(`/profiledashboard/${userProfile?._id}/profilemain`)}
                        sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            gap: 0.5,
                            alignItems: 'center',
                        }}
                    >
                        <Typography 
                            fontWeight={600}
                            fontSize={{xs: 13, md:16}}
                        >
                            {postsAmount}
                        </Typography>

                        <Typography 
                            fontSize={{xs: 13, md:16}}
                            color='text.secondary'
                        >
                            posts
                        </Typography>
                    </Box>
                </Box>
              </Box>

                {/* Stats row */}
                <Box sx={{
                    width: '100%',
                    display: {xs: 'none',md:'flex'},
                    justifyContent: 'start',
                    gap: {xs: 1,md: 3},
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    mr: 2
                }}>
                    <Box 
                        textAlign='center'
                        onClick={() => navigate(`/profiledashboard/${userProfile?._id}/followers`)}
                        sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            gap: 0.5,
                            alignItems: 'center',
                        }}
                    >
                        <Typography 
                            fontWeight={600}
                            fontSize={{xs: 13, md:16}}
                        >
                            {getFollowersCount(userProfile?._id)}
                        </Typography>

                        <Typography 
                            fontSize={{xs: 13, md:16}}
                            color='text.secondary'
                        >
                            followers
                        </Typography>
                    </Box>

                    <Box 
                        textAlign='center'
                        onClick={() => navigate(`/profiledashboard/${userProfile?._id}/following`)}
                        sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            gap: 0.5,
                            alignItems: 'center',
                        }}
                    >
                        <Typography 
                            fontWeight={600}
                            fontSize={{xs: 13, md:16}}
                        >
                            {(userProfile?.following || []).length}
                        </Typography>

                        <Typography 
                            fontSize={{xs: 13, md:16}}
                            color='text.secondary'
                        >
                            following
                        </Typography>
                    </Box>

                    <Box 
                        textAlign='center'
                        onClick={() => navigate(`/profiledashboard/${userProfile?._id}/profilemain`)}
                        sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            gap: 0.5,
                            alignItems: 'center',
                        }}
                    >
                        <Typography 
                            fontWeight={600}
                            fontSize={{xs: 13, md:16}}
                        >
                            {postsAmount}
                        </Typography>

                        <Typography 
                            fontSize={{xs: 13, md:16}}
                            color='text.secondary'
                        >
                            posts
                        </Typography>
                    </Box>
                </Box>      
          </Box>
          
          <Box sx={{display: 'flex', justifyContent: 'space-between', pr:2 }}>
              {/* Name, Job, Location */}
              <Box sx={{mx: {xs: 1, md: 3}, mb:1}}>
                  <Typography 
                        display={{xs: 'none', md: 'block'}}
                        fontWeight={600} 
                        fontSize={25}
                        onClick={() => navigate(`/profiledashboard/${userProfile?._id}/profilemain`)}
                        sx={{cursor: 'pointer', mb: -0.5}}
                  >
                      {userProfile?.name} {userProfile?.lastName}
                  </Typography>

                  <Typography 
                      fontSize={15} 
                      color='text.secondaty' 
                      sx={{mb: -0.5}}
                  >
                      {userProfile?.job}
                  </Typography>

                  <Typography fontSize={13} color='text.disabled'>
                      {userProfile?.address.country}, {userProfile?.address.city}
                  </Typography>
              </Box>
              
              <Box sx={{display: {xs: 'none',md:'flex'}, gap: 1, alignItems: 'center'}}>

                  {user?._id !== userProfile._id && (
                    <>
                      <Button 
                        variant={isFollowByMe(userProfile._id) ? 'outlined' : 'outlined'}
                        startIcon={isFollowByMe(userProfile._id) ? <CheckIcon/> : <PersonAddIcon/>}
                        size='small'
                        sx={{borderRadius: 5, px: 2, py:1, fontSize: 12}}
                        onClick={async() => {
                            if(!isLoggedIn){
                                setIsLoginPopupOpen(true)
                                return;
                            } 
                            await toggleFollow(userProfile._id)
                            await refreshFeed()
                          
                        }}
                        color={isFollowByMe(userProfile._id) ? 'inherit' : 'primary'}
                      >
                        {isFollowByMe(userProfile._id) ? "Following" : "Follow"}
                      </Button>

                      <Button 
                        variant='outlined'
                        sx={{borderRadius: 5, px: 2, py:1, fontSize: 12}}
                        // onClick={() => navigate(`/dashboard/myprofile`)}
                        startIcon={<ChatIcon/>}
                        onClick={() => navigate(`/chat?to=${userProfile._id}`)}
                      >
                          Message
                      </Button>
                      
                      {messageOpen && (
                        <Box
                          sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            zIndex: 1000,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Box
                              sx={{
                                bgcolor: 'background.paper',
                                borderRadius: 3,
                                height: 200,
                                width: 200
                              }}
                          >
                            <Box sx={{position: 'relative', height: '100%', display: 'flex',flexDirection: 'column', gap: 1 , justifyContent: 'center', alignItems: 'center', p: 3, textAlign: 'center'}}>
                              <IconButton 
                                onClick={() => setMessageOpen(!messageOpen)}
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  right: 0,
                                  m: 1,
                                  bgcolor: 'background.paper', 
                                  zIndex: 1100
                                }}
                              >
                                <CloseIcon/>
                              </IconButton>
                                
                                <ChatIcon
                                  sx={{fontSize: 50, transform: 'rotate(10deg)', width: '100%', color: 'primary.main'}}
                                />
                                <Typography fontWeight={700} lineHeight={1}>
                                  This feature will come soon
                                </Typography>
                            </Box>
                          </Box>
                        </Box>
                      )}


                      {selectedUsers.some(selUser => selUser._id === userProfile._id) ? (
                        <Tooltip title="Unsave from Favorites">
                          <IconButton 
                              size='small'
                              sx={{
                                  border: '1px solid',
                                  px: 1.1, 
                                  py:1.1,
                                  bgcolor: 'action.hover',
                                  borderColor: 'primary.main',
                                  color: 'primary.main'
                              }}
                             onClick={() => isLoggedIn ? selectHandleUser(userProfile) : setIsLoginPopupOpen(true)}
                          >
                              <FavoriteIcon sx={{fontSize: 20}}/>
                          </IconButton>
                        </Tooltip>
                      ): (
                        <Tooltip title="Save to favorite users">
                          <IconButton 
                              size='small'
                              sx={{
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  px: 1.1, 
                                  py:1.1,
                                  bgcolor: 'background.paper',
                                  color: 'text.secondary',
                              }}
                              onClick={() => isLoggedIn ? selectHandleUser(userProfile) : setIsLoginPopupOpen(true)}
                          >
                              <FavoriteBorderIcon sx={{fontSize: 20}}/>
                          </IconButton>
                        </Tooltip>
                    )}

                    </>
                  )}

                  {user?._id === userProfile._id && (
                    <Button 
                        size='small'
                        variant='outlined'
                        sx={{
                            borderRadius: 5, 
                            px: {xs: 1.5, md:2}, 
                            py: {xs: 0.5,md:1}, 
                            fontSize: {xs: 10, md: 12}
                        }}
                        onClick={() => navigate(`/dashboard/myprofile`)}
                        startIcon={<SettingsIcon/>}
                      >
                        Profile Settings
                    </Button>
                  )}

              </Box>
          </Box>

        <Box sx={{display: {xs: 'flex',md:'none'}, gap: 1, px:1, pb: 1, alignItems: 'center'}}>

            {user?._id !== userProfile._id && (
            <>
                <Button 
                variant={isFollowByMe(userProfile._id) ? 'outlined' : 'outlined'}
                startIcon={isFollowByMe(userProfile._id) ? <CheckIcon/> : <PersonAddIcon/>}
                size='small'
                sx={{
                    borderRadius: 5, 
                    px: {xs: 1.5, md:2}, 
                    py: {xs: 0.5,md:1}, 
                    fontSize: {xs: 10, md: 12}
                }}
                onClick={async() => {
                    if(!isLoggedIn){
                        setIsLoginPopupOpen(true)
                        return;
                    }
                    await toggleFollow(userProfile._id)
                    await refreshFeed()
                }}
                color={isFollowByMe(userProfile._id) ? 'inherit' : 'primary'}
                >
                {isFollowByMe(userProfile._id) ? "Following" : "Follow"}
                </Button>

                <Button 
                variant='outlined'
                sx={{
                    borderRadius: 5, 
                    px: {xs: 2, md:2}, 
                    py: {xs: 0.5,md:1}, 
                    fontSize: {xs: 10, md: 12}
                }}
                // onClick={() => navigate(`/dashboard/myprofile`)}
                startIcon={<ChatIcon/>}
                onClick={() => isLoggedIn 
                    ? (setMessageOpen(!messageOpen), navigate(`/chat?to=${userProfile._id}`))  
                    : setIsLoginPopupOpen(true)}
                >
                    Message
                </Button>
                
                {messageOpen && (
                <Box
                    sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    }}
                >
                    <Box
                        sx={{
                        bgcolor: 'background.paper',
                        borderRadius: 3,
                        height: 200,
                        width: 200
                        }}
                    >
                    <Box sx={{position: 'relative', height: '100%', display: 'flex',flexDirection: 'column', gap: 1 , justifyContent: 'center', alignItems: 'center', p: 3, textAlign: 'center'}}>
                        <IconButton 
                        onClick={() => setMessageOpen(!messageOpen)}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            m: 1,
                            bgcolor: 'background.paper',
                            zIndex: 1100
                        }}
                        >
                        <CloseIcon/>
                        </IconButton>
                        
                        <ChatIcon
                            sx={{fontSize: 50, transform: 'rotate(10deg)', width: '100%', color: 'primary.main'}}
                        />
                        <Typography fontWeight={700} lineHeight={1}>
                            This feature will come soon
                        </Typography>
                    </Box>
                    </Box>
                </Box>
                )}


                {selectedUsers.some(selUser => selUser._id === userProfile._id) ? (
                <Tooltip title="Unsave from Favorites">
                    <IconButton 
                        size='small'
                        sx={{
                            border: '1px solid',
                            px: {xs: 0.8, md:2}, 
                            py: {xs: 0.8, md:1},
                            bgcolor: 'action.hover',
                            borderColor: 'primary.main',
                            color: 'primary.main'
                        }}
                        onClick={() => isLoggedIn ? selectHandleUser(userProfile) : setIsLoginPopupOpen(true)}
                    >
                        <FavoriteIcon sx={{fontSize: {xs: 17, md:20}}}/>
                    </IconButton>
                </Tooltip>
                ): (
                <Tooltip title="Save to favorite users">
                    <IconButton 
                        size='small'
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            px: {xs: 0.8, md:2}, 
                            py: {xs: 0.8,md:1},
                            bgcolor: 'background.paper',
                            color: 'text.secondary',
                        }}
                        onClick={() => isLoggedIn ? selectHandleUser(userProfile) : setIsLoginPopupOpen(true)}
                    >
                        <FavoriteBorderIcon sx={{fontSize: {xs: 17, md:20}}}/>
                    </IconButton>
                </Tooltip>
            )}

            </>
            )}

            {user?._id === userProfile._id && (
            <Button 
                variant='outlined'
                sx={{
                    borderRadius: 5, 
                    px: {xs: 1.5, md:2}, 
                    py: {xs: 0.5,md:1}, 
                    fontSize: {xs: 10, md: 12}
                }}
                onClick={() => navigate(`/dashboard/myprofile`)}
                startIcon={<SettingsIcon/>}
                >
                Profile Settings
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
                value={`/profiledashboard/${id}/profilemain`}
                onClick={() => navigate(`/profiledashboard/${id}/profilemain`)}
                />

            <Tab 
                sx={{fontSize: {xs: 11, md: 14}}}
                label='About'
                value={`/profiledashboard/${id}/about`}
                onClick={() => navigate(`/profiledashboard/${id}/about`)}
              />

            <Tab 
                sx={{fontSize: {xs: 11, md: 14}}}
                label='Media' 
                value={`/profiledashboard/${id}/media`}
                onClick={() => navigate(`/profiledashboard/${id}/media`)}
            />

            <Tab 
                sx={{fontSize: {xs: 11, md: 14}}}
                label='Following' 
                value={`/profiledashboard/${id}/following`}
                onClick={() => navigate(`/profiledashboard/${id}/following`)}
                />

            <Tab 
                sx={{fontSize: {xs: 11, md: 14}}}
                label='Followers' 
                value={`/profiledashboard/${id}/followers`}
                onClick={() => navigate(`/profiledashboard/${id}/followers`)}
            />

        </Tabs>

        {isLoginPopupOpen && (
            <LoginPopup
                onCloseLoginPopup={onCloseLoginPopup}
            />
        )}

      <Routes>
        <Route index element = {<UserProfileMain/>}/>
        <Route path='/profilemain' element = {<UserProfileMain/>}/>
        <Route path='/about' element = {<UserProfileAbout/>}/>
        <Route path='/following' element = {<UserProfileFollowing/>}/>
        <Route path='/followers' element = {<UserProfileFollowers/>}/>
        <Route path='/media' element = {<UserProfileMedia/>}/>
      </Routes>
    </Container>
  )
}