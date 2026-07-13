import { Box, Chip, Divider, Typography } from '@mui/material';
import React from 'react'
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

export default function UsersRetentionCardReuse({
    mainCount, 
    secondValue, 
    percentsValue, 
    pFirstValue, 
    pVsValue, 
    pPercentsValue
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
            flex: 1,
            width: {xs:'100%', md: 'auto'},
            minHeight: 250,
            bgcolor: 'background.paper'
        }}
    >
        <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
            <Typography fontSize={13} color="text.secondary">{pFirstValue}</Typography>
            {percentsValue >= 0 ? (
                <TrendingUpIcon sx={{fontSize: 35, color: 'success.main'}}/>
            ):(
                <TrendingDownIcon sx={{fontSize: 35, color: 'error.main'}}/>
            )}
        </Box>

        <Typography fontSize={28} fontWeight={700}>{mainCount}</Typography>
        <Typography fontSize={15} color='text.secondary'>
            {mainCount > secondValue ? '+' : ''}
            {mainCount - secondValue}
            {pVsValue} 
        </Typography>
        
        <Divider/>

        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>

            <Chip
                label={`
                    ${percentsValue > 0 ? '+' : ''}
                    ${percentsValue?.toFixed(1)}%
                `}
                size='small'
                sx={{
                    bgcolor: percentsValue >= 0 ? 'success.main' : 'error.main',
                    color: 'white' ,
                    fontWeight: 600,
                    fontSize: 12
                }}
            />

            <Typography fontSize={12} color='text.secondary'>
                {pPercentsValue}
            </Typography>
        </Box>
    </Box>
  )
}
