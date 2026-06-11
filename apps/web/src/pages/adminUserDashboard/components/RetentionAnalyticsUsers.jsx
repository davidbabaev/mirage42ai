import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import UsersRetentionCardReuse from './reusable components/UsersRetentionCardReuse';
import { Box } from '@mui/material';
import RetentionUserRegisterLoginLastTwoWeeks from './RetentionUserRegisterLoginLastTwoWeeks';

export default function RetentionAnalyticsUsers() {

    const {
        // first block - Logged In Today
        dailyActiveUsersCount,
        loggedInYesterdayCount,
        loginGrowthRate,

        // second block - Registered This Week
        newRegisteredUsers_ThisWeek_count,
        newRegisteredUsers_LastWeek_count,
        registeredGrowthRate,

        // third block - Logged In this Week
        weeklyActiveUsersCount,
        moreThenSevenDaysCount,
        weekLoginGrowth
    } = useAnalytics();

  return (
    <Box sx={{
        display: 'flex',
        flexDirection: {xs: 'column', md: 'row'},
        // width: {xs: '100%', md:'auto'},
        gap: 2,
        alignItems: 'start',
        flexWrap: 'wrap',
    }}>
        <UsersRetentionCardReuse 
            mainCount = {dailyActiveUsersCount}
            secondValue = {loggedInYesterdayCount}
            percentsValue = {loginGrowthRate}
            pFirstValue = {"Logged In Today"}
            pVsValue = {" vs Yesterday"}
            pPercentsValue = {" Than yesterday"}
        />

        <UsersRetentionCardReuse 
            mainCount = {newRegisteredUsers_ThisWeek_count}
            secondValue = {newRegisteredUsers_LastWeek_count}
            percentsValue = {registeredGrowthRate}
            pFirstValue = {"Registered This Week"}
            pVsValue = {"  New users on this week"}
            pPercentsValue = {" Than previous week"}
        />

        <UsersRetentionCardReuse 
            mainCount = {weeklyActiveUsersCount}
            secondValue = {moreThenSevenDaysCount}
            percentsValue = {weekLoginGrowth}
            pFirstValue = {"Logged-in this week"}
            pVsValue = {" vs Previous week"}
            pPercentsValue = {" Then previous week "}
        />

        <RetentionUserRegisterLoginLastTwoWeeks/>
    </Box>
  )
}
