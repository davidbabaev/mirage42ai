import { Box, Paper, Typography } from '@mui/material'
import React from 'react'
import CheckBoxIcon from '@mui/icons-material/CheckBox';

export default function UsersPageSorts({
    title,
    options,
    selectedValue,
    onSelect,
    style
}) {
  return (
    <Paper
        elevation={0}
        sx={{
            borderRadius: 3,
            border: '0.5px solid',
            borderColor: 'divider',
            p: 2,
            ...style
        }}
    >
        <Typography fontWeight={600} fontSize={13} mb={1.5}>
            {title}
        </Typography>


        {options.map((option) => (
            <Box
                key={option.value}
                onClick={() => onSelect(option.value)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    borderRadius: 2,
                    px: 1,
                    py: 0.5,
                    my: 1,
                    bgcolor: selectedValue === option.value ? 'action.selected' : 'transparent',
                    '&:hover': {bgcolor: 'action.hover'},
                }}
            >

                {selectedValue === option.value && <CheckBoxIcon sx={{fontSize: 19}}/>}

                <Typography fontSize={13} color='text.secondary'>
                    {option.label}
                </Typography>
            </Box>
            
        ))}
    </Paper>
  )
}
