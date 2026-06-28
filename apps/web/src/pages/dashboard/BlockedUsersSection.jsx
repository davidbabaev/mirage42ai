import { useCallback, useEffect, useState } from 'react';
import { Avatar, Box, Button, CircularProgress, Container, Divider, List, ListItem, ListItemAvatar, ListItemButton, ListItemText, Typography } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import { useNavigate } from 'react-router-dom';
import { getBlockedUsers } from '../../services/apiService';
import useBlockUser from '../../hooks/useBlockUser';

// Settings list of everyone the user has blocked, each with an Unblock action
// (Instagram/Facebook style). This is the discoverable way back to a blocked
// user — clicking a row opens their (locked) profile. Because blocked users are
// server-excluded everywhere else, this list is the only place they appear.
export default function BlockedUsersSection() {
    const { toggleBlock } = useBlockUser();
    const navigate = useNavigate();
    const [blocked, setBlocked] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const list = await getBlockedUsers();
            setBlocked(Array.isArray(list) ? list : []);
        } catch {
            setBlocked([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleUnblock = async (id) => {
        setBusyId(id);
        try {
            await toggleBlock(id);
            setBlocked((prev) => prev.filter((u) => u._id !== id));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Container maxWidth='sm' sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <BlockIcon color='error' />
                <Typography variant='h6'>Blocked users</Typography>
            </Box>
            <Typography color='text.secondary' fontSize={14} sx={{ mb: 2 }}>
                People you block can’t message you, follow you, or see your activity. They won’t appear anywhere else in the app.
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : blocked.length === 0 ? (
                <Typography color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
                    You haven’t blocked anyone.
                </Typography>
            ) : (
                <List disablePadding>
                    {blocked.map((u, i) => (
                        <Box key={u._id}>
                            {i > 0 && <Divider component='li' />}
                            <ListItem
                                disablePadding
                                secondaryAction={
                                    <Button
                                        size='small'
                                        variant='outlined'
                                        disabled={busyId === u._id}
                                        onClick={() => handleUnblock(u._id)}
                                    >
                                        {busyId === u._id ? 'Unblocking…' : 'Unblock'}
                                    </Button>
                                }
                            >
                                <ListItemButton onClick={() => navigate(`/profiledashboard/${u._id}/profilemain`)}>
                                    <ListItemAvatar>
                                        <Avatar src={u.profilePicture} />
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={`${u.name || ''} ${u.lastName || ''}`.trim() || 'User'}
                                        slotProps={{ primary: { sx: { textTransform: 'capitalize' } } }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        </Box>
                    ))}
                </List>
            )}
        </Container>
    );
}
