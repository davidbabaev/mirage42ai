import React from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar ,PieChart, Pie, Cell, CartesianGrid, Legend} from 'recharts';
import { Box, Typography } from '@mui/material';
import MaleIcon from '@mui/icons-material/Male';
import FemaleIcon from '@mui/icons-material/Female';

export default function GenderAndAgesAnalytics() {

    const {arrayGroup_countPerGender, group_genderByAge, usersLength} = useAnalytics();
    const COLORS = { Male: '#3B82F6', Female: '#EC4899' };
    const ICONS = { Male: <MaleIcon sx={{color:'#3B82F6', fontSize: 28}}/>, Female: <FemaleIcon sx={{color:'#EC4899', fontSize: 28}}/> };

  return (
    <Box sx={{display: 'flex',flexDirection: {xs: 'column', md: 'row'}, gap:2, width: '100%'}}>
    
    {/* Left:  Gender Distribution*/}
    <Box
        sx={{
            flex: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            p: 2,
            bgcolor: 'background.paper',
        }}
    >
        <Typography fontWeight={700} fontSize={15}>
            Gender Distribution
        </Typography>

        <Box
            sx={{position: 'relative', display: 'flex', justifyContent: 'center'}}
        >
            <PieChart  width={250} height={250} style={{outline: 'none'}}>
                <Pie 
                    data={arrayGroup_countPerGender} 
                    nameKey="gender" 
                    dataKey="count"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    // label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    
                    >
                    {arrayGroup_countPerGender.map((entry, index) => (
                        <Cell key={index} fill={COLORS[entry.gender] || '#ccc'}/>
                    ))}
                </Pie>
                <Tooltip />
            </PieChart>

            {/* Center label */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center'
                }}
            >
                <Typography fontWeight={700} fontSize={18}>{usersLength}</Typography>
                <Typography fontSize={15} color='text.secondary' lineHeight={0.5}>total</Typography>
            </Box>
        </Box>

        
        {/* Legend */}
        <Box
            sx={{
                display: 'flex', 
                justifyContent: 'center',
                gap: 3,
                mt: 1
            }}
        >               
            {arrayGroup_countPerGender.map((entry) => (
                <Box 
                key={entry.gender}
                sx={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5
                }}
                >
                    {/* <Box
                        sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: COLORS[entry.gender]
                        }}
                    /> */}
                        {ICONS[entry.gender]}
                        <Typography fontSize={14}>{entry.gender}</Typography>
                        <Typography fontSize={14} fontWeight={600}>
                            {(entry.count / usersLength * 100).toFixed(0)}%
                        </Typography>
                </Box>
            ))}
        </Box>
    </Box>

    {/* Right: Gender by Age Range*/}
    <Box
        sx={{
            flex: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            p: 2,
            bgcolor: 'background.paper'
        }}
    >
        <Typography fontWeight={700} fontSize={15} pb={3}>
           Gender by Age Range
        </Typography>

        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={group_genderByAge}>
                
                {/* <Legend /> */}
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis
                    dataKey="ages" 
                    tickLine={false}
                    axisLine={false}
                    tick={{fontSize: 13}} 
                    />
                <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{fontSize: 13}}  
                />
                <Tooltip cursor={false}/>
                <Bar dataKey="Male" stackId="a" fill={COLORS.Male} radius={10}/>
                <Bar dataKey="Female" stackId="a" fill={COLORS.Female} radius={10}/>
            </BarChart>
        </ResponsiveContainer>
    </Box>
    </Box>
  )
}
