import { Box, Button, Typography } from '@mui/material';

/**
 * Full-page fallback rendered by the root Sentry.ErrorBoundary when the React
 * tree crashes.  Uses MUI components (no hand-rolled styles) and provides a
 * clear path out of the dead-end: reload the page.
 */
export default function AppCrashFallback() {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                gap: 2,
                p: 3,
            }}
        >
            <Typography variant="h5" gutterBottom>
                Something went wrong
            </Typography>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center', maxWidth: 400 }}
            >
                An unexpected error occurred. Please refresh the page — if the
                problem continues, try again later.
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
                Refresh page
            </Button>
        </Box>
    );
}
