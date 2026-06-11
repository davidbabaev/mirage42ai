import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { Box, Typography } from '@mui/material';

export default function TenMostPopularCategories() {

    const COLORS = [
        '#0088FE', 
        '#00C49F', 
        '#FFBB28', 
        '#FF8042', 
        '#8884d8', 
        '#6BCB77', 
        '#ff6b6b', 
        '#ffd93d', 
        '#6bcb77', 
        '#4d96ff'
    ];
    const {topTenCategories} = useAnalytics();

    const totalPosts = topTenCategories.reduce((sum, cat) => sum + cat.posts, 0)

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
        width: {xs: '100%',md: '50%'}
      }}
    >
      <Typography fontWeight={700} fontSize={15}>
        10 Most popular categories
      </Typography>


      <Box sx={{display: 'flex', alignItems: 'center',flexDirection: {xs: 'column', md: 'row'} ,gap: 3}}>
          {/* Donut */}
          <Box sx={{position: 'relative'}}>
            <PieChart  width={250} height={250} style={{outline: 'none'}}>
              <Pie 
                data={topTenCategories} 
                nameKey="name" 
                dataKey="posts"
                // label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {topTenCategories.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]}/>
                ))}
              </Pie>
              <Tooltip cursor={false}/>
            </PieChart>

            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              textAlign: 'center'
            }}>
              <Typography fontWeight={700} fontSize={18}>{totalPosts}</Typography>
              <Typography fontSize={14} lineHeight={0.5} color='text.secondary'>Posts</Typography>
            </Box>
          </Box>

          {/* Legend */}
          <Box sx={{display: 'flex', flexDirection: 'column', gap: 1, flex: 1}}>
            {topTenCategories.map((cat, index) => (
              <Box key={cat.name} sx={{display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between'}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                  <Box
                  sx={{
                    width: 10, height: 10, borderRadius: '50%',
                    bgcolor: COLORS[index % COLORS.length],
                    flexShrink: 0
                  }}
                  />
                    <Typography fontSize={13}>{cat.name}</Typography>
                </Box>
                  <Typography fontSize={12} fontWeight={700} color='text.secondary'>{cat.posts}</Typography>
              </Box>

            ))}
          </Box>
      </Box>
    </Box>
  )
}
