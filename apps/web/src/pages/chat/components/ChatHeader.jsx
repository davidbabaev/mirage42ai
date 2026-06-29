import { useState } from 'react';
import { Avatar, Box, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Top bar of the active conversation. Back arrow (mobile) + name + actions menu.
export default function ChatHeader({ otherUser, onBack, onViewProfile, onDeleteChat, onBlock }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const handleOpen = (e) => setAnchorEl(e.currentTarget);
    const handleClose = () => setAnchorEl(null);

    return (
        <Box sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            p:2,
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderRadius: '10px 10px 0px 0px'
        }}>
            <IconButton
                sx={{display: {xs: 'block', md:'none'}, p:0}}
                onClick={onBack}
            >
                <ArrowBackIcon/>
            </IconButton>
            <Avatar
                src={otherUser?.profilePicture}
                onClick={onViewProfile}
                sx={{
                    height: 48,
                    width: 48,
                    cursor: 'pointer'
                }}
            />
            <Box sx={{ flex: 1}}>
                <Typography>
                    {otherUser?.name}
                    {' '}
                    {otherUser?.lastName}
                </Typography>
                <Typography fontSize={12} color='text.secondary'>
                    {otherUser?.job}
                    {' ' + '󠁯ㆍ' + ' '}
                    {otherUser?.address.city}
                </Typography>
            </Box>

            <Box>
                <IconButton onClick={handleOpen} aria-label='More options'>
                    <MoreHorizIcon/>
                </IconButton>
            </Box>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                <MenuItem onClick={() => {
                    handleClose()
                    onViewProfile()
                }}>
                    <PersonIcon sx={{mr:1}}/> Profile
                </MenuItem>

                <MenuItem onClick={() => {
                    handleClose();
                    onDeleteChat();
                }}>
                    <DeleteIcon sx={{mr:1}}/> Delete chat
                </MenuItem>

                <MenuItem
                    onClick={() => {
                        handleClose();
                        onBlock?.();
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <BlockIcon sx={{mr:1}}/> Block user
                </MenuItem>
            </Menu>
        </Box>
    );
}
