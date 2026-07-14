import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useChatDock } from '../../providers/chatDockContext';
import { useAuth } from '../../providers/authContext';
import DockedChatWindow from './DockedChatWindow';
import MessagingBar from './MessagingBar';

// LinkedIn-style docked messaging at the bottom-right: a persistent Messaging bar
// plus the single open chat window to its left. Desktop-only — on mobile the
// "Message" action falls back to the full-screen /chat page, so nothing renders
// here. Also suppressed on the full chat page (/chat) itself.
export default function ChatDock() {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const { pathname } = useLocation();
    const { isLoggedIn } = useAuth();
    const { openUser, closeChat } = useChatDock();

    if (!isDesktop || !isLoggedIn || pathname === '/chat') return null;

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
                pointerEvents: 'none', // let clicks pass except on the bar/window themselves
            }}
        >
            {/* the single open chat window sits to the LEFT of the bar */}
            {openUser && (
                <DockedChatWindow otherUser={openUser} onClose={closeChat} />
            )}
            <MessagingBar />
        </Box>
    );
}
