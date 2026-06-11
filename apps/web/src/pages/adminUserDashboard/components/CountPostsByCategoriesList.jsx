import React, { useState } from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { Box, Button, Chip, Typography } from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

export default function CountPostsByCategoriesList() {

    const {arrayCountPerCategory} = useAnalytics();
    const [expand, setExpand] = useState(false);
    const [count, setCount] = useState(10)

    const countedArr = arrayCountPerCategory.slice(0, count)

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
            width: {xs: '100%', md: '40%'}
        }}
    >
        <Typography fontWeight={700} fontSize={15}>Posts per catrgories</Typography>

        <Box>
            {countedArr.map((item, index) => (
                <Box
                    key={index}
                    sx={{
                        display:'flex',
                        justifyContent: 'space-between',
                        gap: 7,
                        pt: 1
                    }}
                >   
                    <Typography fontSize={14}>{item.name}</Typography>
                    <Chip color={'text.secondary'} sx={{fontSize: 11}} size='small' label = {item.posts}/>
                </Box>
            ))}

            {arrayCountPerCategory.length > count && (
                <Button 
                    onClick={() => setCount(count + 5)}
                    variant='outlined'
                    sx={{fontSize: 10, borderRadius: 5, mt:2}}
                    startIcon={<ArrowDownwardIcon/>}
                >
                    Show more
                </Button>    
            )}

            {arrayCountPerCategory.length <= count && (
                <Button 
                    onClick={() => setCount(10)}
                    variant='outlined'
                    sx={{fontSize: 10, borderRadius: 5, mt:2}}
                    startIcon={<ArrowUpwardIcon/>}
                >
                    Show less
                </Button>
            )}
        </Box>
    </Box>
  )
}
