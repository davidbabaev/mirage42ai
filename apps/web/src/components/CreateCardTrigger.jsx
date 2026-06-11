import { Avatar, Box, Button, Input, Paper, Typography } from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie';
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import { useAuth } from '../providers/AuthProvider';
import { useNavigate } from 'react-router-dom';


export default function CreateCardTrigger({onOpen}) {

    const {user} = useAuth();
    const navigate = useNavigate();

  return (
    <Paper 
        elevation={0}
        sx={{
            border: '0.5px solid',
            borderColor: 'divider',
            borderRadius: 3,
            p: 2
        }}
    >
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2}}>
            <Avatar 
                onClick={() => navigate(`/profiledashboard/${user?._id}/profilemain`)} 
                src={user?.profilePicture}
                sx={{cursor: 'pointer'}}
            />
            <Box
                onClick={() => onOpen()}
                sx={{
                    flex: 1,
                    border: '0.5px solid',
                    borderColor: 'divider',
                    borderRadius: 5,
                    px: 2,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    '&:hover': {bgcolor: 'action.hover'}
                }}
            >
                <Typography color='text.secondary' fontSize={14}>
                    Start a post...
                </Typography>
            </Box>
        </Box>

        <Box sx={{display: 'flex', gap: 1}}>
            <Button color='inherit' onClick={() => onOpen('video')} startIcon={<MovieIcon/>}>Video</Button>
            <Button color='inherit' onClick={() => onOpen('image')} startIcon={<InsertPhotoIcon/>}>Photo</Button>
        </Box>
        
    </Paper>
  )
}
