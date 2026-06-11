import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Box, Typography } from '@mui/material';

export default function TopTenActiveUsers() {

    const {topTenUsers} = useAnalytics();

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
            width: "100%"
        }}>
        <Typography fontWeight={700} fontSize={15}>Top 10 Active Users</Typography>
        <ResponsiveContainer  
            width="100%" height={400}>
            <BarChart 
                data={topTenUsers}
                layout='vertical'
                margin={{top: 5, right: 40, left: 20, bottom: 5}}
            >
                <XAxis type='number' hide/>
                <YAxis 
                    dataKey="name" 
                    type='category'
                    width={120}
                    tick={{fontSize:14}}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip cursor={false}/>
                <Bar 
                    dataKey="posts" 
                    fill="#7F77DD" 
                    radius={10}
                    barSize={30}
                    label={{position: 'right', fontSize:13}}

                />
            </BarChart>
        </ResponsiveContainer>
    </Box>
  )
}
