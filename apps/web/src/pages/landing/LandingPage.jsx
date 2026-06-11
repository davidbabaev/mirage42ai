import React, { useState } from 'react'
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  Stack,
  AppBar,
  Toolbar,
  Chip,
  ImageList,
  ImageListItem,
  Dialog,
  IconButton,
  useTheme,
  useMediaQuery,
  Avatar
} from '@mui/material'
import PhoneIcon from '@mui/icons-material/Phone'
import ChatIcon from '@mui/icons-material/Chat'
import WorkOutlineIcon from '@mui/icons-material/WorkOutline'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import DescriptionIcon from '@mui/icons-material/Description'
import EmailIcon from '@mui/icons-material/Email'
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import BuildIcon from '@mui/icons-material/Build'
import StyleIcon from '@mui/icons-material/Style'
import UpdateIcon from '@mui/icons-material/Update'
import DevicesIcon from '@mui/icons-material/Devices'
import CloseIcon from '@mui/icons-material/Close'
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import heroImg from '../../assets/hero-landingPage.png'
import MirageLogo from '../../assets/MirageLogo'

import profilePage from '../../assets/profilePage.png'
import usersPage from '../../assets/usersPage.png'
import editProfile from '../../assets/editProfile.png'
import myPosts from '../../assets/myPosts.png'
import postsPanel from '../../assets/postsPanel.png'
import usersPanel from '../../assets/usersPanel.png'
import adminOverview from '../../assets/adminOverview.png'
import messages from '../../assets/messages.png'
import postsPage from '../../assets/postsPage.png'
import createPost from '../../assets/createPost.png'
import postDetails from '../../assets/postDetails.png'
import loginPage from '../../assets/loginPage.png'
import registerPage from '../../assets/registerPage.png'
import feedPage from '../../assets/feedPage.png'

import mongo from '../../assets/logos/mongodb_original_wordmark_logo_icon_146425.png'
import node from '../../assets/logos/Node.js_logo.svg'
import npm from '../../assets/logos/Npm-logo.svg.png'
import react from '../../assets/logos/React-icon.svg.png'
import vite from '../../assets/logos/Vitejs-logo.svg.png'
import socketio from '../../assets/logos/socketio.png'
import mui from '../../assets/logos/mui.png'
import js from '../../assets/logos/js.png'
import cloudinary from '../../assets/logos/cloudinary.png'
import env from '../../assets/logos/env.png'
import express from '../../assets/logos/express.png'
import jwt from '../../assets/logos/jwt.png'
import mongoose from '../../assets/logos/mongoose.png'

import david from '../../assets/david.jpg'

import GitHubIcon from '@mui/icons-material/GitHub';
import YouTubeIcon from '@mui/icons-material/YouTube';
import HomeIcon from '@mui/icons-material/Home';
import AddToDriveIcon from '@mui/icons-material/AddToDrive';
import { useNavigate } from 'react-router-dom';
import LoginIcon from '@mui/icons-material/Login';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const PRIMARY = '#7F77DD'
const PRIMARY_DARK = '#6961D6'

/**
 * Reusable empty image slot.
 * Replace any <ImagePlaceholder ... /> with:
 *   <Box component="img" src="/your-image.png" alt="..." sx={{ width, height, objectFit: 'cover' }} />
 */
const ImagePlaceholder = ({ width = '100%', height = 200, label = 'Image', radius = 2 }) => (
  <Box
    sx={{
      width,
      height,
      bgcolor: 'rgba(127, 119, 221, 0.08)',
      border: '2px dashed',
      borderColor: 'rgba(127, 119, 221, 0.35)',
      borderRadius: radius,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(127, 119, 221, 0.85)',
      fontSize: 13,
      fontWeight: 500,
      textAlign: 'center',
      p: 1
    }}
  >
    {label}
  </Box>
)

const SectionTitle = ({ eyebrow, title, subtitle, light = false }) => (
  <Box sx={{ textAlign: 'center', mb: 6 }}>
    <Typography
      sx={{
        color: light ? 'rgba(255,255,255,0.85)' : PRIMARY,
        fontWeight: 700,
        letterSpacing: 2,
        mb: 1,
        fontSize: 13
      }}
    >
      {eyebrow}
    </Typography>
    <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: light ? '#fff' : 'inherit' }}>
      {title}
    </Typography>
    {subtitle && (
      <Typography
        sx={{
          color: light ? 'rgba(255,255,255,0.85)' : 'text.secondary',
          maxWidth: 720,
          mx: 'auto',
          fontSize: 14
        }}
      >
        {subtitle}
      </Typography>
    )}
  </Box>
)

export default function LandingPage() {

  const navigate = useNavigate();
  const [openImg, setOpenImg] = useState(null)

  const images = [
    profilePage,
    usersPage,
    editProfile,
    myPosts,
    postsPanel,
    usersPanel,
    adminOverview,
    messages,
    postsPage,
    createPost,
    postDetails,
    loginPage,
    registerPage,
    feedPage
  ];

  const logos = [
    mongo,
    node,
    npm,
    react,
    vite,
    socketio,
    mui,
    js,
    cloudinary,
    env,
    express,
    jwt,
    mongoose
  ]

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const cols = isDesktop ? 3 : 1


  return (
    <Box sx={{ bgcolor: '#fff' }}>

      {/* ============ NAV ============ */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ bgcolor: '#fff', color: '#333', borderBottom: '1px solid #eee' }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ py: 1 }}>
            {/* Logo */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{flexGrow: 1 }}>
              <MirageLogo/>
            </Stack>

            {/* CTAs */}
            <Stack sx={{display: {xs: 'none',md: 'flex'}}} direction="row" spacing={2}>
              <Button 
                startIcon={<GitHubIcon/>} 
                variant='contained'
                href='https://github.com/davidbabaev'
                target='_blank'
                rel='noreferrer'
              >
                GitHub
              </Button>
            <Button 
                startIcon={<YouTubeIcon/>} 
                variant='contained'
                href='https://www.youtube.com/@david_kingdom'
                target='_blank'
                rel='noreferrer'
                >
                Youtube
              </Button>
            <Button 
                startIcon={<AddToDriveIcon/>} 
                variant='contained'
                href='https://drive.google.com/drive/folders/1h584KX_ducyfIwFz0EIE_QAz140hP7n2?usp=sharing'
                target='_blank'
                rel='noreferrer'
              >
                Drive Docs
              </Button>
            <Button 
                startIcon={<HomeIcon/>} 
                variant='contained'
                onClick={() => navigate('/')}
              >
                App Preview
              </Button>
            </Stack>
            <Box sx={{
                display: {xs: 'flex',md:'none'},
                gap: 2
              }}>
                <IconButton
                  href='https://github.com/davidbabaev'
                  target='_blank'
                  rel='noreferrer'
                  >
                  <GitHubIcon/>
                </IconButton>
        
                <IconButton
                  href='https://www.youtube.com/@david_kingdom'
                  target='_blank'
                  rel='noreferrer'
                >
                  <YouTubeIcon/>
                </IconButton>
        
                <IconButton
                  href='https://drive.google.com/drive/folders/1h584KX_ducyfIwFz0EIE_QAz140hP7n2?usp=sharing'
                  target='_blank'
                  rel='noreferrer'
                >
                  <AddToDriveIcon/>
                </IconButton>
        
                <IconButton
                  onClick={() => navigate('/')}
                >
                  <HomeIcon/>
                </IconButton>
              </Box>  
          </Toolbar>
        </Container>
      </AppBar>

      {/* ============ HERO ============ */}
      <Box
        sx={{
          background: `linear-gradient(135deg, 
          ${PRIMARY} 0%, #5e57c2 100%)`,
          color: '#fff',
          pt: 8,
          pb: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography sx={{fontSize:{xs: 30,md: 40}, lineHeight:{xs: 1.2,md: 'auto'} ,fontWeight: 700, mb: 3 }}>
            React & NodeJS - Social Media Web App
          </Typography>
          <Typography sx={{ mb: 4, opacity: 0.9, maxWidth: 760, mx: 'auto', fontSize: 14 }}>
            Mirage is a full-stack social media platform built end-to-end as a portfolio project. Real-time messaging, photo and video sharing, profiles, feeds, follows, comments, likes, notifications, and a complete admin dashboard — all written from scratch with React, Node.js, and MongoDB.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
            sx={{ mb: 6 }}
          >
            <Button
              variant="contained"
              startIcon={<LoginIcon />}
              onClick={() => navigate('/login')}
              sx={{
                bgcolor: '#ec4899',
                '&:hover': { bgcolor: '#db2777' },
                borderRadius: 5,
                px: 3,
                textTransform: 'none'
              }}
            >
              Login
            </Button>
            <Button
              variant="contained"
              startIcon={<AccountCircleIcon />}
              onClick={() => navigate('/registered')}
              sx={{
                bgcolor: '#10b981',
                '&:hover': { bgcolor: '#059669' },
                borderRadius: 5,
                px: 3,
                textTransform: 'none'
              }}
            >
              Register
            </Button>
            <Button
              variant="contained"
              startIcon={<DescriptionIcon />}
              onClick={() => navigate('/docs')}
              sx={{
                bgcolor: '#3b82f6',
                '&:hover': { bgcolor: '#2563eb' },
                borderRadius: 5,
                px: 3,
                textTransform: 'none'
              }}
            >
              Documentation
            </Button>
          </Stack>
        </Container>

        {/* Hero dashboard image arrangement */}
          <Box
            component={'img'}
            src={heroImg}
            sx={{
              width: {xs: '100%',md:'80%'},
              height: 'auto', 
              display: 'block',
            }}
          />
        {/* </Container> */}
      </Box>

      {/* ============ SCREENSHOTS ============ */}
      <Container maxWidth="lg" sx={{ py: 10}}>
        <SectionTitle
          eyebrow="DEMOS"
          title="Mirage Screenshots"
          subtitle="A look at every major surface in the app — feed, profiles, chat, post creation, and the admin dashboards. Click any image to view it full size."
        />

        <ImageList cols={cols} gap={8} rowHeight={220}>
          {images.map((src) => (
            <ImageListItem
              key={src}
              onClick ={() => setOpenImg(src)}
              sx={{cursor: 'pointer'}}
            >
              <Box
                component={'img'}
                src={src}
                sx={{
                  width: '100%', 
                  height: '100%',
                  borderRadius: 2,
                  objectFit: 'cover',
                  objectPosition: 'top'
                }}
              />
            </ImageListItem>
          ))}
        </ImageList>

        <Dialog
          open={!!openImg}
          onClose={() => setOpenImg(null)}
          maxWidth="lg"
          fullWidth
        >
          <IconButton
            onClick={() => setOpenImg(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: '#fff',
              zIndex: 1
            }}
          >
            <CloseIcon/>
          </IconButton>
          
          <Box
            component={'img'}
            src={openImg}
            sx={{width:'100%', display: 'block'}}
          />
        </Dialog>

      </Container>

      {/* ============ TECH STACK ============ */}
      <Box sx={{ bgcolor: PRIMARY, color: '#fff', py: 10 }}>
        <Container maxWidth="lg">
          <SectionTitle
            eyebrow="MAIN TECHNOLOGIES"
            title="Tech Stack"
            subtitle="Every layer of Mirage was built with production-grade tools — from the React + Vite frontend and the Express API, to the Socket.IO real-time layer and the managed cloud services. Below is the full stack used across the project."
            light
          />
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'center'
          }}>
            {logos.map((tech) => (
                <Card
                  key={tech}
                  sx={{
                    p: 1,
                    textAlign: 'center',
                    borderRadius: 3,
                    boxShadow: 2,
                    width: {xs: 80, md: 110},
                    minHeight: {xs: 80, md: 100},
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <Box
                    component={'img'}
                    src={tech}
                    sx={{width: '70%'}}
                  />
                </Card>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ============ ABOUT THE PROJECT ============ */}
      <Box sx={{ bgcolor: '#f7f7fb', py: 10 }}>
        <Container maxWidth="lg">
          <SectionTitle
            eyebrow="ABOUT THE CREATING PROCESS"
            title="How this project was built"
            subtitle="This project was built over the course of 8 months, with more than 1,200 hours of focused learning, coding, debugging, and hands-on development. To make the process transparent and prove that the project was not created with vibe coding tools or simple prompt engineering, I documented almost every part of my journey from zero. Overall, this project represents hundreds of days of consistent work, deep learning, problem solving, and real hands-on development."
          />
          <Stack spacing={2}>
            {[
              {
                icon: <GitHubIcon />,
                bg: '#f59e0b',
                title: 'GitHub',
                text:
                  'I used GitHub for daily commits, showing consistent progress throughout the project.'
              },
              {
                icon: <YouTubeIcon />,
                bg: PRIMARY,
                title: 'Youtube - Study with me',
                text:
                  "I also recorded my process on YouTube, where I documented at least 95% of my coding and study time through screen recordings. So far, I have uploaded around 220 daily study videos, with each video lasting between 6 and 12 hours."
              },
              {
                icon: <AddToDriveIcon/>,
                bg: '#3b82f6',
                title: 'Google Drive Docs',
                text:
                  "In addition, I documented my learning process in Google Drive Docs on a daily basis for months. This includes dozens of files, project roadmaps, debugging notes, study logs, and detailed explanations of my progress."
              },
              {
                icon: <HourglassBottomIcon />,
                bg: '#10b981',
                title: 'Toggl Track',
                text:"Finally, I used Toggl Track to track the actual time I spent studying and building the project during the last 8 months."
              },
            ].map((item) => (
              <Card key={item.title} sx={{ p: 3, borderRadius: 2, boxShadow: 1}}>
                <Stack direction='row' spacing={3} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      bgcolor: item.bg,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{item.title}</Typography>
                    <Typography sx={{ color: 'text.primary', fontSize: 15 }}>
                      {item.text}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ============ CONTACT STRIP ============ */}
      <Box sx={{ bgcolor: PRIMARY, py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} sx={{justifyContent: {xs: 'start',md: 'center'}}}>
            {[
              { icon: <Avatar src={david} />, label: 'Me', value: 'David Babaev' },
              { icon: <EmailIcon />, label: 'My Email', value: 'davidbabaev175@gmail.com' },
              { icon: <ChatIcon />, label: 'Phone', value: '058-799-9156' },
            ].map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.label}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'rgba(255,255,255,0.15)',
                      color: 'common.white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'common.white', fontSize: 13 }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontWeight: 600 }} color='common.white'>{item.value}</Typography>
                  </Box>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ============ MAIN FEATURES ============ */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <SectionTitle
          eyebrow="WHAT'S IN THE APP"
          title="Main Features"
          subtitle="A snapshot of the user-facing features in Mirage. The full feature list and the permissions matrix live in the documentation."
        />
        <Grid container spacing={2}>
          {[
            'Real-Time Chat — bidirectional WebSocket messaging powered by Socket.IO',
            'Photo & Video Sharing — image and video uploads handled by Cloudinary',
            'Emoji Picker — built directly into the chat input',
            'Google Sign-In — OAuth 2.0 flow via Passport.js',
            'User Profiles — public profiles with followers, following, and full post history',
            "Posts & Feed — personalized feed showing posts from people you follow",
            'Private Conversations — delete a chat and it disappears for both participants in real time',
            "Mobile Optimized — responsive layouts with a portrait-first mobile experience",
          ].map((feature) => (
            <Grid item xs={12} sm={6} key={feature}>
              <Card sx={{ p: 2.5, borderRadius: 2, boxShadow: 1 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(127,119,221,0.12)',
                      color: PRIMARY,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    <AutoFixHighIcon/>
                  </Box>
                  <Typography sx={{ fontWeight: 600 }}>{feature}</Typography>
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ============ FOOTER ============ */}
      <Box sx={{ bgcolor: '#1a1a1a', color: '#fff', py: 5 }}>
        <Container maxWidth="lg">
          <Stack alignItems="center" spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{display: 'flex',bgcolor: 'white', borderRadius: 3, justifyContent: 'center', p:1}}>
                <MirageLogo/>
              </Box>
            </Stack>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
              Mirage — built by David Babaev. React, Node.js, MongoDB, Socket.IO.
              © 2025 David Babaev. All rights reserved
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                startIcon={<LoginIcon />}
                onClick={() => navigate('/login')}
                sx={{
                  bgcolor: '#ec4899',
                  '&:hover': { bgcolor: '#db2777' },
                  borderRadius: 5,
                  px: 3,
                  textTransform: 'none'
                }}
              >
                Login
              </Button>
              <Button
                variant="contained"
                startIcon={<AccountCircleIcon />}
                onClick={() => navigate('/registered')}
                sx={{
                  bgcolor: '#10b981',
                  '&:hover': { bgcolor: '#059669' },
                  borderRadius: 5,
                  px: 3,
                  textTransform: 'none'
                }}
              >
                Register
              </Button>
              <Button
                variant="contained"
                startIcon={<DescriptionIcon />}
                onClick={() => navigate('/docs')}
                sx={{
                  bgcolor: '#3b82f6',
                  '&:hover': { bgcolor: '#2563eb' },
                  borderRadius: 5,
                  px: 3,
                  textTransform: 'none'
                }}
              >
                Documentation
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}