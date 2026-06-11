import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { Box, LinearProgress, Typography } from '@mui/material';

export default function CountriesAnalytics() {

    const {group_countCountriesPerUsers} = useAnalytics();

  return (
    <Box
      sx={{
        display: 'flex', 
        flexDirection: 'column',
        border: '1px solid',
        borderRadius: 3,
        borderColor: 'divider',
        p: 2,
        bgcolor: 'background.paper',
        width: '100%'
      }}
    >
        <Typography fontWeight={700} fontSize={15} mb={3}>
          Users by Country
        </Typography>

        {group_countCountriesPerUsers.map((item, index) => (
          <Box 
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mb:1.5
            }}
          >
            <Box
              component={'img'} 
              src={item.flag} 
              onError= {(e) => e.target.src = "https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png"}
              sx={{
                width: 35,
                height: 20,
                borderRadius: 1,
                objectFit: 'cover',
                flexShrink: 0
              }}
            />
            <Typography fontSize={14} lineHeight={1}>
              {item.country}
            </Typography>

            <Box
              sx={{
                flex: 1,
                position: 'relative'
              }}
            >

              <LinearProgress
                variant='determinate'
                value={Number(item.percent)}
                sx={{
                  height: 22,
                  borderRadius: 5,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar' : {
                    bgcolor: 'primary',
                    borderRadius: 5
                  }
                }}
              />

              <Typography sx={{
                position: 'absolute',
                top: '50%',
                left: 8,
                transform: 'translateY(-50%)',
                fontSize: 11,
                fontWeight: 600,
                color: 'white'
              }}>
                {item.percent}%
              </Typography>  
            </Box>
            <Typography color='text.secondary' fontSize={14} fontWeight={700}>
              {item.count}
            </Typography>
          </Box>
        ))}
    </Box>
  )
}
