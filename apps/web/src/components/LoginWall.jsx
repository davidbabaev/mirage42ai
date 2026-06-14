import { Box, Button, Paper, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LoginIcon from '@mui/icons-material/Login';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// In-place gated state for pages that need data a signed-out visitor isn't
// entitled to. Rendered instead of empty/broken UI; the URL is preserved.
export default function LoginWall({
    title = 'Sign in to explore Mirage',
    subtitle = "Browse people, posts, and profiles once you're signed in.",
}) {
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                minHeight: '60vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 2,
                py: 6,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 420,
                    p: { xs: 4, md: 5 },
                    textAlign: 'center',
                    borderRadius: 3,
                    border: '0.5px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                }}
            >
                <LoginIcon
                    color="primary"
                    sx={{ fontSize: 72, transform: 'rotate(10deg)', mb: 2 }}
                />

                <Typography fontSize={22} fontWeight={700} mb={1}>
                    {title}
                </Typography>

                <Typography fontSize={14} color="text.secondary" mb={3}>
                    {subtitle}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        endIcon={<ArrowForwardIcon />}
                        sx={{ borderRadius: 5, py: 1, fontSize: 13 }}
                        onClick={() => navigate('/login')}
                    >
                        Login
                    </Button>
                    <Button
                        variant="outlined"
                        fullWidth
                        sx={{ borderRadius: 5, py: 1, fontSize: 13 }}
                        onClick={() => navigate('/registered')}
                    >
                        Create an account
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}
