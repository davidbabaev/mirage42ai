import { useState } from 'react';
import { Avatar, Box, Button, Container, Paper, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

// The only view shown for a user the viewer has blocked. Reachable solely from
// the Blocked-users settings list (blocked users are hidden everywhere else).
// Deliberately shows NO real content — a lock, a placeholder avatar and a short
// banner — never the blocked user's posts or details.
export default function LockedProfile({ onUnblock }) {
    const [busy, setBusy] = useState(false);

    const handleUnblock = async () => {
        setBusy(true);
        try {
            await onUnblock();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Container maxWidth='sm' sx={{ py: 6 }}>
            <Paper
                elevation={0}
                sx={{
                    borderRadius: 4,
                    p: { xs: 3, md: 5 },
                    textAlign: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Box sx={{ position: 'relative', width: 96, height: 96, mx: 'auto', mb: 2 }}>
                    {/* Placeholder/mock avatar — no real photo of the blocked user */}
                    <Avatar sx={{ width: 96, height: 96, bgcolor: 'action.disabledBackground' }} />
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(0,0,0,0.45)',
                            borderRadius: '50%',
                        }}
                    >
                        <LockIcon sx={{ color: '#fff', fontSize: 36 }} />
                    </Box>
                </Box>

                <Typography variant='h6' sx={{ mb: 0.5 }}>
                    This account is blocked
                </Typography>
                <Typography color='text.secondary' fontSize={14} sx={{ mb: 3 }}>
                    You’ve blocked this user. Their profile, posts and activity are hidden from you. Unblock them to see their profile again.
                </Typography>

                <Button variant='contained' onClick={handleUnblock} disabled={busy}>
                    {busy ? 'Unblocking…' : 'Unblock'}
                </Button>
            </Paper>
        </Container>
    );
}
