import React from 'react';
import { Card, Box, Skeleton } from '@mui/material';

// Placeholder shaped like a real feed CardItem (avatar header → text → media →
// action row), shown while a feed page is in flight so the layout doesn't jump.
export default function FeedCardSkeleton() {
    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: 3,
                border: '0.5px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
                mb: 2,
            }}
            aria-hidden="true"
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
                <Skeleton variant="circular" width={44} height={44} />
                <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="40%" height={18} />
                    <Skeleton variant="text" width="25%" height={14} />
                </Box>
            </Box>
            <Box sx={{ px: 2 }}>
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="70%" />
            </Box>
            <Skeleton variant="rectangular" height={280} sx={{ mt: 1 }} />
            <Box sx={{ display: 'flex', gap: 2, p: 2 }}>
                <Skeleton variant="rounded" width={64} height={28} />
                <Skeleton variant="rounded" width={64} height={28} />
                <Skeleton variant="rounded" width={64} height={28} />
            </Box>
        </Card>
    );
}
