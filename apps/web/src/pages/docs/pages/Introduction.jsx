import { Box, Divider, List, ListItem, ListItemIcon, ListItemText, Paper, Typography } from '@mui/material'
import React from 'react'
import ArrowRightIcon from '@mui/icons-material/ArrowRight';

export default function Introduction() {

  const listItems = [
    {label: 'Domain:', text: 'https://mirage42.com'},
    {label: 'Creator:', text: 'David Babaev'},
    {label: 'Email:', text: 'davidbabaev175@gmail.com'},
    {label: 'Hours spent:', text: '1181hr'},
    {label: 'Total workign & study time:', text: '8 months'},
    {label: 'Note:', text: 'no vibe codind was used!'},
    {label: 'Note:', text: 'whole coding and learning proccess has been screen recorded and published on Youtube, daily for months.'},
    {label: 'Note:', text: 'whole project study and coding proccess has been documentade and planned in Google Drive docs on daily rutine for months.'},
  ]

  const studyRecources = [
    {label: 'Tool:', text: 'Claude.ai'},
    {label: 'Tool:', text: 'ChatGpt'},
    {label: 'Tool:', text: 'Mdn'},
    {label: 'Tool:', text: 'W3Schools'},
    {label: 'Course:', text: 'HackerU collage'},
  ]

  return (
    <Box sx={{display:'flex', gap: 5, flexDirection: 'column'}}>
      <Paper 
        elevation={3}
        sx={{p:3, borderRadius: 3}}
      >
        <Typography fontSize={18} fontWeight={700}>About the project</Typography>
        <Typography fontSize={14}>
          Welcome to Mirage42 – React & Node - Social Media Web App
        </Typography>
        <Divider sx={{my:2}}/>
          {listItems.map((item) => (
            <Box sx={{display: 'flex', pb: 0.5}}>
                <ArrowRightIcon/>
                <Typography sx={{pr: 1, fontSize: 14}}>{item.label}</Typography>
                <Typography fontSize={14} fontWeight={700}>{item.text}</Typography>
            </Box>
          ))}
      </Paper>

      <Paper 
        elevation={3}
        sx={{p:3, borderRadius: 3}}
      >
        <Typography fontSize={18} fontWeight={700}>Study sources</Typography>
        <Typography fontSize={14}>
          what recources did i used for studing
        </Typography>
        <Divider sx={{my:2}}/>
          {studyRecources.map((item) => (
            <Box sx={{display: 'flex', pb: 0.5}}>
                <ArrowRightIcon/>
                <Typography sx={{pr: 1, fontSize: 14}}>{item.label}</Typography>
                <Typography fontSize={14} fontWeight={700}>{item.text}</Typography>
            </Box>
          ))}
      </Paper>
    </Box>
  )
}
