import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Paper, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import useFollowUser from '../hooks/useFollowUser';

// Mobile-only "People you may know": a horizontal carousel of compact
// suggestion cards inserted between feed posts, plus a "See all" modal listing
// every suggestion. Desktop keeps its existing right-column sidebar, so this
// renders only at xs (the caller wraps it in display:{xs:'block', md:'none'}).
function SuggestionRow({ u, onNavigate }) {
    const { toggleFollow, isFollowByMe } = useFollowUser();
    const following = isFollowByMe(u._id);
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
            <Avatar
                src={u.profilePicture}
                sx={{ width: 44, height: 44, cursor: 'pointer' }}
                onClick={() => onNavigate(u._id)}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap fontWeight={600} fontSize={14} sx={{ cursor: 'pointer' }} onClick={() => onNavigate(u._id)}>
                    {u.name} {u.lastName}
                </Typography>
                <Typography noWrap fontSize={12} color='text.secondary'>{u.job}</Typography>
            </Box>
            <Button
                size='small'
                variant={following ? 'outlined' : 'contained'}
                color={following ? 'inherit' : 'primary'}
                startIcon={!following && <PersonAddIcon />}
                onClick={() => toggleFollow(u)}
                sx={{ borderRadius: 5, fontSize: 11, minWidth: 84 }}
            >
                {following ? 'Following' : 'Follow'}
            </Button>
        </Box>
    );
}

export default function MobileSuggestions({ suggestions = [] }) {
    const navigate = useNavigate();
    const { toggleFollow, isFollowByMe } = useFollowUser();
    const [dismissed, setDismissed] = useState(() => new Set());
    const [modalOpen, setModalOpen] = useState(false);

    const visible = useMemo(
        () => suggestions.filter((u) => !dismissed.has(u._id)),
        [suggestions, dismissed]
    );

    if (visible.length === 0) return null;

    const goToProfile = (id) => navigate(`/profiledashboard/${id}/profilemain`);
    const dismiss = (id) => setDismissed((prev) => new Set(prev).add(id));

    return (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2, my: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <PeopleAltOutlinedIcon fontSize='small' color='action' />
                <Typography fontWeight={600} fontSize={16}>People you may know</Typography>
            </Box>

            {/* horizontal carousel of compact cards */}
            <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, scrollbarWidth: 'thin' }}>
                {visible.slice(0, 10).map((u) => {
                    const following = isFollowByMe(u._id);
                    return (
                        <Paper
                            key={u._id}
                            variant='outlined'
                            sx={{ flex: '0 0 auto', width: 150, borderRadius: 2, position: 'relative', overflow: 'hidden' }}
                        >
                            <IconButton
                                size='small'
                                aria-label='dismiss suggestion'
                                onClick={() => dismiss(u._id)}
                                sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.35)', color: 'white', p: 0.25, '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' } }}
                            >
                                <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>

                            <Box sx={{ cursor: 'pointer', pt: 2, px: 1 }} onClick={() => goToProfile(u._id)}>
                                <Avatar src={u.profilePicture} sx={{ width: 72, height: 72, mx: 'auto' }} />
                                <Typography align='center' noWrap fontWeight={600} fontSize={13} sx={{ mt: 1 }}>
                                    {u.name} {u.lastName}
                                </Typography>
                                <Typography align='center' noWrap fontSize={11} color='text.secondary'>
                                    {u.job}
                                </Typography>
                            </Box>

                            <Box sx={{ p: 1 }}>
                                <Button
                                    fullWidth
                                    size='small'
                                    variant={following ? 'outlined' : 'contained'}
                                    color={following ? 'inherit' : 'primary'}
                                    onClick={() => toggleFollow(u)}
                                    sx={{ borderRadius: 5, fontSize: 11 }}
                                >
                                    {following ? 'Following' : 'Follow'}
                                </Button>
                            </Box>
                        </Paper>
                    );
                })}
            </Box>

            <Button fullWidth size='small' onClick={() => setModalOpen(true)} sx={{ mt: 1, textTransform: 'none' }}>
                See all
            </Button>

            <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth='xs'>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    People you may know
                    <IconButton size='small' aria-label='close' onClick={() => setModalOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {visible.map((u) => (
                        <SuggestionRow key={u._id} u={u} onNavigate={(id) => { goToProfile(id); setModalOpen(false); }} />
                    ))}
                </DialogContent>
            </Dialog>
        </Paper>
    );
}
