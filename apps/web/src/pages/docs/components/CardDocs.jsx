import { Box, Divider, Paper, Typography } from '@mui/material'
import React from 'react'
import ArrowRightIcon from '@mui/icons-material/ArrowRight';


export default function CardDocs({array, title}) {

  return (
    <Paper 
        elevation={3}
        sx={{p:3, borderRadius: 3}}
    >
        <Typography fontSize={18} fontWeight={700}>{title}</Typography>
        <Divider sx={{my:2}}/>
          {array.map((item) => (
            <Box key={item.label || item.text}>
              <Box sx={{display: {xs: 'none',md: 'flex'}, pb: 0.5}}>
                <ArrowRightIcon/>
                <Typography sx={{pr: 1, fontSize: 14}} fontWeight={700}>{item.label}</Typography>
                <Typography fontSize={14}>{item.text}</Typography>
              </Box>

              <Box sx={{display: {xs: 'flex',md: 'none'}, pb: 1.5}}>
                <Box sx={{display: item.label ? 'flex' : 'none', flexDirection: 'column'}}>
                  <Box sx={{display: 'flex'}}>
                    <ArrowRightIcon/>
                    <Typography sx={{pr: 1, fontSize: 14}} fontWeight={700}>{item.label}</Typography>
                  </Box>
                  <Typography fontSize={14}>{item.text}</Typography>
                </Box>

                <Box sx={{display: item.label ? 'none' : 'flex'}}>
                  <ArrowRightIcon/>
                  <Typography sx={{pr: 1, fontSize: 14}} fontWeight={700}>{item.label}</Typography>
                  <Typography fontSize={14}>{item.text}</Typography>
                </Box>

              </Box>
            </Box>
          ))}
      </Paper>
  )
}
