import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LoginIcon from '@mui/icons-material/Login';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useEffect } from 'react';
export default function LoginPopup({onCloseLoginPopup}) {

    const navigate = useNavigate();
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
        document.body.style.overflow = 'unset'
        }
    }, [])

  return (
    <Box
        sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
        }}
    >
        <Box
            sx={{
                display: 'flex',
                bgcolor: 'background.paper',
                borderRadius: 3,
                // p:0,
                width: '90vw',
                maxWidth: 350,
                maxHeight: 'min(85vh, 680px)',
                overflow: 'hidden',
                position: 'relative',
                p:5,
                flexDirection: 'column',
                textAlign: 'center',
                
            }}
        >

            <LoginIcon
                color = 'primary'
                sx={{fontSize: 90, transform: 'rotate(10deg)', width: '100%', mb: 2}}
            />
            
            <Typography fontSize={18} lineHeight={0.5} mb={2} fontWeight={700}>
                Sign in to use this feature      
            </Typography>

            {/* <Typography fontSize={20} fontWeight={700}>
                {message}                
            </Typography> */}

            <Box sx={{
                display: 'flex', 
                flexDirection: 'column',
                gap: 1, 
                alignItems: 'center',
                justifyContent: 'center',
                pt: 2
            }}
            >
                <Button 
                    variant='contained'
                    color='primary'
                    size='small'
                    fullWidth
                    sx={{borderRadius: 5, px: 2, py:1,fontSize: 12}}
                    endIcon={<ArrowForwardIcon/>}
                    onClick={() => navigate('/login')}
                >
                    Login
                </Button>

                <Button 
                    variant='outlined'
                    fullWidth
                    size='small'
                    sx={{borderRadius: 5, px: 2, py:1, fontSize: 12}}
                    onClick={onCloseLoginPopup}
                >
                    Close
                </Button>

            </Box>
        </Box>
    </Box>

)
}


/*     <div
        
    >
        <div
            style={{backgroundColor: 'white', width: '20%', height: '20%', borderRadius: '20px', alignContent: 'center', textAlign: 'center'}}
        >
            
                <div>
                    <h3>Login For Use Features</h3>
                    <button onClick={() => navigate('/login')}>login</button>
                    <br />
                    <br />
                    <button onClick={onCloseLoginPopup}>close</button>
                </div>
            
        </div>
    </div> */



