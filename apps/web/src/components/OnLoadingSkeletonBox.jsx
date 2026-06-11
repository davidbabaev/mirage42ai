import { Box, Skeleton } from '@mui/material'
import React from 'react'

export default function OnLoadingSkeletonBox() {
  return (
    <Box sx={{display: 'flex', gap: 1.5, p:2}}>
        <Skeleton variant='circular' width={48} height={48}/>
        <Box>
            <Skeleton variant='text' width={120}/>
            <Skeleton variant='text' width={80}/>
        </Box>
    </Box>
  )
}
