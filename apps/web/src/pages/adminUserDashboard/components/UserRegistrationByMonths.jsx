import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { LineChart, Line, ResponsiveContainer,XAxis, YAxis, Tooltip, AreaChart, Area} from 'recharts';
import { Box, Typography } from '@mui/material';


export default function UserRegistrationByMonths() {

const {arrayGroupUsersRegistarationByMonth} = useAnalytics();

  return (
    <Box
        sx={{
            display: 'flex', 
            flexDirection: 'column',
            border: '1px solid',
            borderRadius: 3,
            borderColor: 'divider',
            p: 2,
            bgcolor: 'background.paper'
        }}
    >
    <Typography fontWeight={700} fontSize={15} mb={3}>Users registration</Typography>

    <ResponsiveContainer  
        width="100%" height={300}>
        <AreaChart 
            data={arrayGroupUsersRegistarationByMonth}
        >
            <defs>
                <linearGradient id='regGradient' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset={'0%'} stopColor='#7F77DD' stopOpacity={0.30}/>
                    <stop offset={'100%'} stopColor='#7F77DD' stopOpacity={0}/>
                </linearGradient>
            </defs>
            <XAxis 
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{fontSize:13}}
            />
            <YAxis hide/>
            <Tooltip cursor={false}/>
            <Area
               type={'monotone'}
               dataKey={'users'}
               stroke='#7F77DD'
               strokeWidth={2}
               fill='url(#regGradient)'
               dot={true}
            />
        </AreaChart>
    </ResponsiveContainer>
    </Box>
  )
}
