import { Box } from '@mui/material'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Introduction from './pages/Introduction'
import Features from './pages/Features'
import Technologies from './pages/Technologies'
import DocsSidebar from './components/DocsSidebar'
import DocsNavBar from './components/DocsNavBar'
import DocsPager from './components/DocsPager'

export default function DocsLayout() {

  return (
      <Box sx={{display: 'flex', height: {xs: '100dvh',md:'100vh'}}}>

        <Box sx={{height: {xs: '100dvh',md:'100vh'}, display:{xs: 'none', md: 'flex'}}}>
          <DocsSidebar/>
        </Box>

        <Box sx={{
          flex: 1,
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <DocsNavBar/>

          <Box sx={{flex: 1, overflow: 'auto'}}>
            <Box sx={{
              minHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              maxWidth: {xs: '100%',md: 1000},
              // mx: 'auto',
              px: {xs: 1, md:4}
            }}>
              <Box sx={{flex: 1, py:4}}>
                <Routes>
                    <Route path='/' element={<Introduction/>}/>
                    <Route path='/features' element={<Features/>}/>
                    <Route path='/technologies' element={<Technologies/>}/>
                </Routes>
              </Box>
            </Box>
          </Box>
          <DocsPager/>
        </Box>
      </Box>
  )
}
