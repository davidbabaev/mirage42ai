import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { LineChart, Line, ResponsiveContainer, AreaChart, Area, Tooltip, XAxis} from 'recharts';
import { Box, Typography } from '@mui/material';

export default function LoggedInThirtyDays() {

    const {
        loggedInThirtyDaysCount,
        arrayGroupUsersLoginActivity,
    } = useAnalytics();

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
                minWidth: 200,
                minHeight: 200,
                bgcolor: 'background.paper'
            }}
        >

            <Typography fontSize={15} color="text.secondary">
                Logged In this Month
            </Typography>

            <Typography fontSize={23} fontWeight={700}>
                {loggedInThirtyDaysCount}
            </Typography>


            <ResponsiveContainer width={'100%'} height={60}>
            <AreaChart data={arrayGroupUsersLoginActivity}>
                <defs>
                    <linearGradient id='loginGradiant' x1="0" y1='0' x2='0' y2='1'>
                        <stop offset='0%' stopColor='#7F77DD' stopOpacity={0.3}/>
                        <stop offset='100%' stopColor='#7F77DD' stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <XAxis dataKey={'day'} hide/>
                <Tooltip/>
                <Area
                    type='monotone'
                    dataKey='users'
                    stroke='#7F77DD'
                    fill='url(#loginGradiant)'
                    dot={true}
                />
            </AreaChart>
            </ResponsiveContainer>
        </Box>
  )
}
