import { Box, Typography } from "@mui/material"

export default function StatCardReuse({value, label, icon, color}) {

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      p:3,
      gap: 1,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 3,
      // minWidth: 200,
      minHeight: 200,
      bgcolor: 'background.paper'
    }}>
      <Box sx={{
        width: 40, height: 40, borderRadius: 2,
        bgcolor: color + '20', // adds transparency to the color
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color
      }}>
        {icon}
      </Box>

      <Typography fontSize={15} color="text.secondary">{label}</Typography>
      <Typography fontSize={23} fontWeight={700}>{value}</Typography>
    </Box>
  )
}
