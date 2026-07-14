import React, { useEffect, useState } from 'react'
import { useAuth } from '../providers/authContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Divider, TextField, Typography, useTheme } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import MirageLogo from '../assets/MirageLogo';
import bgImg from '../assets/Gemini_Generated_Image_ssn5lpssn5lpssn5.png'
import bgImgMobile from '../assets/Gemini_Generated_Image_ssn5lpssn5lpssn5.png'

export default function LoginPage() {

  const[password, setPassword] = useState('')
  const[email, setEmail] = useState('')
  const [error, setError] = useState('');
  const theme = useTheme();

  const {handleLogin} = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if(errorParam === 'banned') setError('You Banned :(')
    if(errorParam === 'deleted') setError('Your account no longer exists')
  },[]);


  const handleSubmit = async (e) => {
    e.preventDefault();

    if(password.trim().length < 6){
      setError('smaller then 6 characters')
      return;
    }

    if(!email.trim().includes('@')){
      setError('not email includes')
      return;
    }

    const result = await handleLogin(email, password);

    if(!result.success){
      setError(result.message);
      return;
    }

    navigate('/dashboard/myprofile');
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: {xs: 'column',md: 'row'},
      minHeight: '100vh',
      width: '100%'
    }}>

      {/* Left side image */}
      <Box sx={{
        flex: 1,
        minHeight: {xs: '30vh', md:'100vh'},
        backgroundImage: {xs: `url(${bgImgMobile})` ,md:`url(${bgImg})`},
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      />

      {/* Right side form */}
      <Box sx={{
        flex: 0.8,
        minHeight: {xs: '70vh',md: '100vh'},
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        borderRadius: {xs: 0,md: '24px 0 0 24px'},
        ml: {xs: '0px',md: '-24px'},
        zIndex: 1
      }}>
        {/* Form Card */}
        <Box sx={{
          width: 400,
          p: 4,
          bgcolor: 'background.paper',
            '& input:-webkit-autofill': {
              // theme.palette.background.paper
              // reads the actual color value from the theme, switches automatically between dark/light
              // theme.palette.text.primary: same for text color
              WebkitBoxShadow: `0 0 0 1000px ${theme.palette.background.paper} inset`,
              WebkitTextFillColor: theme.palette.text.primary,
              transition: 'background-color 5000s ease-in-out 0s'
          }
        }}>
          <MirageLogo/>

          <Typography
            variant='h4'
            fontWeight={600}
            sx={{mt: 3, mb: 0.5}}
          >
            Welcome Back
          </Typography>
          <Typography 
            fontSize={16} 
            color='text.secondary'>
              Sign in to your Mirage account
          </Typography>

          <TextField
            fullWidth
            variant='outlined'
            label='Email'
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{mb: 2, mt: 3}}
          />
          <TextField
            fullWidth
            label='Password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{mb: 2}}
            variant='outlined'
          />

          {error && (
            <Alert severity='error' sx={{mb: 2}}>
              {error}
            </Alert>
          )}
          
          {/* Login Button */}
          <Button
            fullWidth
            variant='contained'
            size='large'
            onClick={handleSubmit}
          >
            Sign In
          </Button>

          {/* Divider */}
          <Divider sx={{my: 2}}>
            <Typography fontSize={12} color='text.secondary'>or continue with</Typography>
          </Divider>

          {/* Google button */}
          <Button
            fullWidth
            variant='outlined'
            startIcon={<GoogleIcon/>}
            href={`${import.meta.env.VITE_API_URL}/auth/google`}
            sx={{mb: 3}}
          >
            Continue with Google
          </Button>

          {/* rgistered link */}
          <Typography fontSize={13} color='text.secondary' textAlign='center'>
              Don't have an account?{' '}
              <span
                style={{color: '#7F77DD', cursor: 'pointer', fontWeight: 600}}
                onClick={() => navigate('/registered')}
              >
                Sign up
              </span>
          </Typography>

        </Box>
      </Box>
    </Box>
  )
}
