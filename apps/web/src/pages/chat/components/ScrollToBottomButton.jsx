import { Box, Chip, Fab } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

// Floating control shown only when the user has scrolled up. When new messages
// arrived while scrolled up, it becomes a "New messages" pill; otherwise a
// simple jump-to-bottom button.
export default function ScrollToBottomButton({ visible, hasNew, onClick }) {
    if (!visible) return null;

    return (
        <Box sx={{ position: 'absolute', bottom: 88, right: 16, zIndex: 5 }}>
            {hasNew ? (
                <Chip
                    label="New messages"
                    color="primary"
                    onClick={onClick}
                    icon={<KeyboardArrowDownIcon />}
                    sx={{ boxShadow: 3, cursor: 'pointer', fontWeight: 600, pl: 0.5 }}
                />
            ) : (
                <Fab
                    size="small"
                    onClick={onClick}
                    aria-label="Scroll to latest"
                    sx={{ bgcolor: 'background.paper', color: 'text.primary', boxShadow: 3, '&:hover': { bgcolor: 'action.hover' } }}
                >
                    <KeyboardArrowDownIcon />
                </Fab>
            )}
        </Box>
    );
}
