import React from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './providers/AuthProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { CardsProvider } from './providers/CardsProvider'
import NavBar from './components/NavBar'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import CreateCardPage from './pages/CreateCardPage'
import SignUpPage from './pages/SignUpPage'
import AllCardsPage from './pages/AllCardsPage'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import UserProfileLayout from './pages/userProfilePublicLayout/UserProfileLayout'
import UsersPage from './pages/UsersPage'
import FeedPage from './pages/FeedPage'
import AdminDashboardLayout from './pages/adminUserDashboard/layout/AdminDashboardLayout'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'
import { Box } from '@mui/material'
import ChatPage from './pages/chat/ChatPage'
import { UsersProvider } from './providers/UsersProvider'
import { UIProvider } from './providers/UIProvider'
import { VideoCoordinatorProvider } from './providers/VideoCoordinatorProvider'
import { ChatProvider } from './providers/ChatProvider'
import { ChatDockProvider } from './providers/ChatDockProvider'
import ChatDock from './components/chatDock/ChatDock'
import OnboardingWizard from './components/OnboardingWizard'
import { PresenceProvider } from './providers/PresenceProvider'
import RotateOverlay from './components/style/RotateOverlay'
import RequireAuth from './components/RequireAuth'
import ScrollToTop from './components/ScrollToTop'
import PageNotFound from './pages/PageNotFound'
import LandingPage from './pages/landing/LandingPage'
import DocsLayout from './pages/docs/DocsLayout'

export default function App(){

  const location = useLocation()
  
  return(
    <AuthProvider>
      <ThemeProvider>
        <CardsProvider>
          <UsersProvider>
            <UIProvider>
              <VideoCoordinatorProvider>
              <PresenceProvider>
              <ChatProvider>
              <ChatDockProvider>
              <ScrollToTop/>
              <RotateOverlay/>
              <Box
                sx={{
                  height: '100dvh',
                  display: 'flex',
                  flexDirection: 'column',
                  // overflow: 'auto'
                }}>
                {!(
                  location.pathname.includes('/admindashboard') ||
                  location.pathname.includes('/login') ||
                  location.pathname.includes('/about') ||
                  location.pathname.includes('/docs') ||
                  location.pathname.includes('/register')
                ) && (
                  <NavBar/>
                )}
                <Box sx={{
                  flex: 1, 
                  minHeight: 0 , 
                  bgcolor: 'Background.default',
                  overflow: 'auto'
                }}
                  id='app-scroll-container'
                >
                  <Routes>
                    <Route path='/' element={
                      <ProtectedRoute>
                        <FeedPage/>
                      </ProtectedRoute>
                    }/>
                    <Route path='/about' element={
                        <LandingPage/>
                    }/>
                    <Route path='/docs/*' element={
                        <DocsLayout/>
                    }/>
                    <Route path='/admindashboard/*' element={
                      <AdminProtectedRoute> 
                        <AdminDashboardLayout/>
                      </AdminProtectedRoute>
                    }/>
                    <Route path='/login' element={
                      <PublicOnlyRoute>
                        <LoginPage/>
                      </PublicOnlyRoute>
                    }/>
                    <Route path='/dashboard/*' element={
                      <ProtectedRoute>
                        <DashboardLayout/>
                      </ProtectedRoute>
                    }/>
                    <Route path='/profiledashboard/:id/*' element={
                      <RequireAuth>
                        <UserProfileLayout/>
                      </RequireAuth>
                    }/>
                    <Route path='/createnewcard' element={
                      <ProtectedRoute>
                        <CreateCardPage/>
                      </ProtectedRoute>
                    }/>
                    <Route path='/allusers' element ={
                      <RequireAuth>
                        <UsersPage/>
                      </RequireAuth>
                    }/>
                    <Route path='/*' element ={<PageNotFound/>}/>
                    <Route path='/registered' element ={
                      <PublicOnlyRoute>
                        <SignUpPage/>
                      </PublicOnlyRoute>
                    }/>
                    <Route path='/allcards' element ={
                      <RequireAuth>
                        <AllCardsPage/>
                      </RequireAuth>
                    }/>
                    <Route path='/chat' element={
                        <ProtectedRoute>
                        <ChatPage/>
                      </ProtectedRoute>
                    }/>
                  </Routes>
                </Box>

              </Box>
              <ChatDock/>
              <OnboardingWizard/>
              </ChatDockProvider>
              </ChatProvider>
              </PresenceProvider>
              </VideoCoordinatorProvider>
            </UIProvider>
          </UsersProvider>
        </CardsProvider>
      </ThemeProvider>
    </AuthProvider>  
  )
}