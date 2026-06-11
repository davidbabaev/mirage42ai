import RetentionAnalyticsUsers from './components/RetentionAnalyticsUsers';
import MostPopular from './components/MostPopular';
import TotalAnalytics from './components/TotalAnalytics';
import LoggedInThirtyDays from './components/LoggedInThirtyDays';
import TopAndLastFiveCards from './components/TopAndLastFiveCards';
import LastFiveJoinedUsers from './components/LastFiveJoinedUsers';
import CountPostsByCategoriesList from './components/CountPostsByCategoriesList';
import TopTenActiveUsers from './components/TopTenActiveUsers';
import TenMostPopularCategories from './components/TenMostPopularCategories';
import GenderAndAgesAnalytics from './components/GenderAndAgesAnalytics';
import UserRegistrationByMonths from './components/UserRegistrationByMonths';
import CountriesAnalytics from './components/CountriesAnalytics';
import { Box, Typography } from '@mui/material';

export default function AdminOverViewPanel() {
  return (
    <Box sx={{p:{xs: 2,md:3}, maxWidth: '100%'}}>

      {/* Page header */}
      <Box mb={3}>
        <Typography fontSize={25} fontWeight={700}>Dashboard</Typography>
        <Typography fontSize={15} color='text.secondary' lineHeight={1}>
          Welcome back. Here's what's happening with your platform.
        </Typography>
      </Box>

      {/* Row 1: stat cards + 30 day cahrt */}
      <Box sx={{mb: 3, display: 'flex', flexDirection:{xs: 'column', md: 'row'}, gap:2}}>
        <TotalAnalytics/>

        <Box sx={{display:'grid',gap:2, flex: 1}}>
          <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr',md:'1fr 1fr'} ,gap: 2}}>
            <UserRegistrationByMonths/>
            <Box sx={{display: 'flex', flexDirection: 'column',gap: 2}}>
              <MostPopular/>
              <LoggedInThirtyDays/>
            </Box>
          </Box>
          <Box sx={{display:'flex', flexDirection: 'column', gap: 2}}>
            <RetentionAnalyticsUsers/>
          </Box>
        </Box>
      </Box>

      {/* Users header */}
      <Box mb={3}>
        <Typography fontSize={25} fontWeight={700}>Users</Typography>
        <Typography fontSize={15} color='text.secondary' lineHeight={1}>
          Welcome back. Here's what's happening with your platform.
        </Typography>
      </Box>
      <Box sx={{display: 'flex', flexDirection: {xs: 'column', md: 'row'} ,gap: 2, mb: 2}}>
        <LastFiveJoinedUsers/>
        <TopTenActiveUsers/>
        <CountriesAnalytics/>
      </Box>


      <Box sx={{display: 'flex', flexDirection: {xs: 'column', md: 'row'}, gap: 2}}>
        <TenMostPopularCategories/>
        <CountPostsByCategoriesList/>
        <GenderAndAgesAnalytics/>
      </Box>

      {/* posts header */}
      <Box mb={3} mt={3}>
        <Typography fontSize={25} fontWeight={700}>Posts</Typography>
        <Typography fontSize={15} color='text.secondary' lineHeight={1}>
          Welcome back. Here's what's happening with your platform.
        </Typography>
      </Box>

      <Box mb={2}>
        <TopAndLastFiveCards/>
      </Box>
    </Box>
)
}

