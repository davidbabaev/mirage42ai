import { Box, Divider, Paper, Typography } from '@mui/material'
import React from 'react'
import ArrowRightIcon from '@mui/icons-material/ArrowRight';

export default function Technologies() {
  const backend  = [
    {text: 'NodeJs'},
    {text: 'MongoDB'},
    {text: 'socket.io'},
    {text: 'Bcryptjs'},
    {text: 'Chalk'},
    {text: 'Cloudinary'},
    {text: 'Cors'},
    {text: 'Dotenv'},
    {text: 'Express'},
    {text: 'Joi'},
    {text: 'JWT - jsonwebtoken'},
    {text: 'Lodash'},
    {text: 'Mongoose'},
    {text: 'Morgan'},
    {text: 'Multer'},
    {text: 'Passport'},
    {text: 'passport-google-oauth20'},
  ]

  const frontend = [
    {text: 'JavaScript'},
    {text: 'React'},
    {text: 'MUI'},
    {text: 'NPM'},
    {text: 'Vite'},
    {text: 'globals'},
    {text: 'Recharts'},
    {text: 'Day.js'},
  ]

  const production = [
    {text: 'Cloudflare'},
    {text: 'Render'},
    {text: 'MongoDB Atlas'},
  ]

  return (
    <Box sx={{display:'flex', gap: 3, flexWrap:'wrap'}}>
      <Paper 
        elevation={3}
        sx={{p:3, borderRadius: 3,  width: {xs: '100%',md:300}}}
      >
        <Typography fontSize={18} fontWeight={700}>Backend technologies</Typography>
        <Divider sx={{my:2}}/>
          {backend.map((item) => (
            <Box sx={{display: 'flex', pb: 0.5}}>
                <ArrowRightIcon/>
                <Typography sx={{fontSize: 14}}>{item.text}</Typography>
            </Box>
          ))}
      </Paper>

      <Paper 
        elevation={3}
        sx={{p:3, borderRadius: 3}}
      >
        <Typography fontSize={18} fontWeight={700}>Frontend Technologies</Typography>
        <Divider sx={{my:2}}/>
          {frontend.map((item) => (
            <Box sx={{display: 'flex', pb: 0.5}}>
                <ArrowRightIcon/>
                <Typography sx={{fontSize: 14}}>{item.text}</Typography>
                {/* <Typography fontSize={14} fontWeight={700}>{item.text}</Typography> */}
            </Box>
          ))}
          <Typography fontSize={14} fontWeight={700} pb={0.5}>
          Third-party APIs
        </Typography>
        <Box sx={{display: 'flex', pb: 0.5}}>
            <ArrowRightIcon/>
            <Typography sx={{fontSize: 14}}>
              https://restcountries.com/v3.1
            </Typography>
        </Box>
        <Box sx={{display: 'flex', pb: 0.5}}>
            <ArrowRightIcon/>
            <Typography sx={{fontSize: 14}}>
              https://countriesnow.space/api
            </Typography>
        </Box>
      </Paper>

      <Paper 
        elevation={3}
        sx={{p:3, borderRadius: 3}}
      >
        <Typography fontSize={18} fontWeight={700}>Production Technologies</Typography>
        <Divider sx={{my:2}}/>
          {production.map((item) => (
            <Box sx={{display: 'flex', pb: 0.5}}>
                <ArrowRightIcon/>
                <Typography sx={{fontSize: 14}}>{item.text}</Typography>
                {/* <Typography fontSize={14} fontWeight={700}>{item.text}</Typography> */}
            </Box>
          ))}
      </Paper>
    </Box>
  )
}
