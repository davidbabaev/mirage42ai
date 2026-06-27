import React from 'react';
import { Badge } from '@mui/material';

// Wraps an avatar with a small presence dot in the bottom-right corner:
// green when the user is online, grey when offline. Reused by the users list
// and the chat conversation list so the indicator looks identical everywhere.
export default function OnlineBadge({ online, children, sx, ...props }) {
    return (
        <Badge
            overlap='circular'
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            variant='dot'
            sx={[
                {
                    '& .MuiBadge-badge': {
                        backgroundColor: online ? 'success.main' : 'grey.400',
                        color: online ? 'success.main' : 'grey.400',
                        boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                    },
                },
                // Caller styles (positioning/layout of the badge wrapper) merge
                // on top without clobbering the dot styling above.
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            {children}
        </Badge>
    );
}
