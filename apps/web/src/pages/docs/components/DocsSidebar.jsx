import { Box, Divider, Typography } from '@mui/material'
import React from 'react'
import MirageLogo from '../../../assets/MirageLogo'
import { useNavigate } from 'react-router-dom'
import { DOCS_PAGES } from '../docsConfig';

export default function DocsSidebar() {

    const navLinkSx = (path) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 2,
      py: 2,
      bgcolor: location.pathname === path ? 'action.selected' : 'transparent',
      color: location.pathname === path ? 'primary.main' : 'text.secondary',
      borderLeft: location.pathname === path ? '3px solid' : '3px solid transparent',
      borderLeftColor: location.pathname === path ? 'primary.main' : 'transparent',
      cursor: 'pointer',
      width: '100%'
    })

    const navigate = useNavigate();

  return (
    <Box sx={{
      width: 260,
      borderRight: '0.5px solid',
      borderColor: 'divider',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box sx={{py:1.6}}>
        <MirageLogo/>
      </Box>
      <Divider/>

        <Box sx={{
          display: 'flex', 
          flexDirection: 'column',
        }}>
          {DOCS_PAGES.map((page, index) => {
            const Icon = page.icon
            return(
              <Box
                key={page.path}
                onClick={() => navigate(page.path)}
                sx={navLinkSx(page.path)}
                >
                <Icon fontSize='small'/>
                <Typography variant='caption' fontSize={14}>
                  {page.label}
                </Typography>
              </Box>
            )
          })}
        </Box>
    </Box>
  )
}
