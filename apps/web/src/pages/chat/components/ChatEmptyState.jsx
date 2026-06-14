import { Box, Typography } from '@mui/material';
import MessageIcon from '@mui/icons-material/Message';

// Shown in the right pane when no conversation is selected.
export default function ChatEmptyState() {
    return (
        <Box
            sx={{
                height: '80vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                p: 4
            }}
        >
            <Box sx={{
                borderRadius: '50%',
                bgcolor: '#7F77DD20',
                width: 90,
                height: 90,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <MessageIcon sx={{
                    fontSize: 50,
                    color: 'primary.main'
                }}/>
            </Box>
            <Typography fontWeight={700} fontSize={20}>Your Messages</Typography>
            <Typography
                fontSize={14}
                textAlign={'center'}
                maxWidth={320}
                lineHeight={1.2}
                color='text.secondary'
            >
                Select a conversation to start chatting, or message someone new from their profile.
            </Typography>
        </Box>
    );
}
