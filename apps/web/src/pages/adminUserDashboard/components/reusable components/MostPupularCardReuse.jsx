import { Avatar, Box, Typography } from '@mui/material'
import React from 'react'

export default function MostPupularCardReuse({
    valueTitle, 
    valueCount, 
    title, 
    description,
    icon,
  }) {

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        p:3,
        gap: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        width: '100%',
        minHeight: 200,
        bgcolor: 'background.paper'
      }}
    >   
        <Box sx={{
          width: 40, height: 40, borderRadius: 2,
          bgcolor: "#7F77DD" + '20', // adds transparency to the color
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: "#7F77DD"
        }}>
          {icon}
        </Box>
        <Typography fontSize={15} color="text.secondary">{title}</Typography>
        <Typography fontSize={23} fontWeight={700}>{valueTitle?.slice(0,20)+ '..'}</Typography>
        <Typography fontSize={15} color="text.secondary">{description}</Typography>
        <Typography fontSize={23} fontWeight={700}>{valueCount}</Typography>
    </Box>
  )
}
