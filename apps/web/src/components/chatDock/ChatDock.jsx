import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useChatDock } from '../../providers/ChatDockProvider';
import DockedChatWindow from './DockedChatWindow';

// Renders the row of docked chat windows at the bottom-right of the screen.
// Desktop-only — on mobile, "Message" falls back to the full-screen /chat page,
// so nothing is rendered here.
export default function ChatDock() {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const { docks, closeDock, toggleMinimize } = useChatDock();

    if (!isDesktop || docks.length === 0) return null;

    return (
        <Box
            sx={{
                position: 'fixed',
                right: 16,
                bottom: 0,
                zIndex: 1300,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1.5,
                pointerEvents: 'none', // let clicks pass except on the windows themselves
            }}
        >
            {docks.map((d) => (
                <DockedChatWindow
                    key={d.otherUser._id}
                    otherUser={d.otherUser}
                    minimized={d.minimized}
                    onClose={() => closeDock(d.otherUser._id)}
                    onToggleMinimize={() => toggleMinimize(d.otherUser._id)}
                />
            ))}
        </Box>
    );
}
