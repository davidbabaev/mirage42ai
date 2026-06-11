import React, { useMemo, useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useNavigate } from 'react-router-dom';
import useCountries from '../hooks/useCountries';
import { JOB_INDUSTRIES } from '../constants/usersJobIndustries';
import useCities from '../hooks/useCities';
import { getAgeByDate, getMaxBirthDate } from '../utils/getAgeByBirthDate';
import { Alert, Box, Button, Divider, MenuItem, Stack, TextField, Typography, useTheme } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import MirageLogo from '../assets/MirageLogo';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { useThemeContext } from '../providers/ThemeProvider';
import bgImg from '../assets/Gemini_Generated_Image_ssn5lpssn5lpssn5.png'
import bgImgMobile from '../assets/Gemini_Generated_Image_78keg978keg978ke.png'


export default function RegisteredPage() {

    const theme = useTheme();

    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [job, setJob] = useState('');
    const [gender, setGender] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [phone, setPhone] = useState('');
    const [aboutMe, setAboutMe] = useState('');
    
    const {cities, isCitiesLoading} = useCities(country);

    const handleCountryChange = (e) => {
        setCountry(e.target.value);
        setCity('')
    }

    const {handleRegister} = useAuth();
    const {apiCountriesList} = useCountries();

    // navigation
    const navigate = useNavigate();

    // BirthDate function, handling
    const maxDate = useMemo(() => getMaxBirthDate(13), []);

    
    // handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if(name.trim() === ''){
            setError('Name is required');
            return;
        }
        
        if(password.trim().length < 6){
            setError('Password must be at least 6 characters');
            return;
        }
        
        if(!email.trim().includes('@')){
            setError('email must includes @');
            return;
        }

        if(country === ''){
            setError('Country is Required');
            return;
        }

        if(city === ''){
            setError('City is Required');
            return;
        }

        if(gender === ''){
            setError('Gender is Required');
            return;
        }

        if(birthDate === ''){
            setError('Birth date required')
            return;
        }

        const calculatedAge = getAgeByDate(birthDate);

        if(calculatedAge < 13){
            setError("Age required and must be 13 or older")
            return;
        }

        const result = await handleRegister(
            {
                email: email, 
                password: password, 
                name: name, 
                address: {
                    country: country, 
                    city: city,
                },
                age: calculatedAge, 
                gender: gender, 
                phone: phone, 
                lastName: lastName, 
                job: job,
                birthDate: birthDate,
                aboutMe: aboutMe,
            }
        );
        
        if(!result.success) {
            setError(result.message);
            return;
        }
        navigate('/dashboard/myprofile')
    }


  return (
    <Box sx={{
      display: 'flex',
      flexDirection: {xs: 'column', md:'row'},
      minHeight: '100vh',
      width: '100%'
    }}>

      {/* Left side image */}
      <Box sx={{
        flex: 1,
        minHeight: {xs: '30vh', md:'100vh'},
        backgroundImage: {xs: `url(${bgImg})` ,md:`url(${bgImgMobile})`},
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}/>

      {/* Right side form */}
      <Box sx={{
        flex: 0.8,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        borderRadius: '24px 0 0 24px',
        ml: {xs: '0px',md: '-24px'},
        zIndex: 1,
        overflowY: 'auto'
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
            Create Account
          </Typography>
          <Typography 
            fontSize={16} 
            color='text.secondary'>
              Join Mirage today
          </Typography>

          {/* Name Row */}
          <Stack direction='row' spacing={2} sx={{ mt: 3, mb: 2}}>
            <TextField
                fullWidth
                variant='outlined'
                label='First Name'
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            
            <TextField
                fullWidth
                variant='outlined'
                label='Last Name'
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
            />
          </Stack>

        <TextField
            fullWidth
            variant='outlined'
            label='Email'
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete='off'
            sx={{mb: 2}}
          />

          <TextField
            fullWidth
            label='Password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='new-password'
            sx={{mb: 2}}
            variant='outlined'
          />

          <Stack direction='row' spacing={2} sx={{mb: 2}}>
            <TextField
                fullWidth
                select
                variant='outlined'
                label='Country'
                value={country}
                onChange={handleCountryChange}
            >
                {apiCountriesList.map((country) => (
                    <MenuItem 
                        key={country.code} 
                        value={country.name}
                    >
                        {country.name}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                fullWidth
                select
                variant='outlined'
                label='City'
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={country === '' || isCitiesLoading}
            >
                {cities.map((cityApi) => (
                    <MenuItem 
                        key={cityApi} 
                        value={cityApi}
                    >
                        {cityApi}
                    </MenuItem>
                ))}
            </TextField>
          </Stack>

          <Stack direction='row' spacing={2} sx={{mb:2}}>
            <TextField
                fullWidth
                select
                variant='outlined'
                label='Job Industry'
                value={job}
                onChange={(e) => setJob(e.target.value)}
            >
                {JOB_INDUSTRIES.map((job) => (
                    <MenuItem 
                        key={job} 
                        value={job}
                    >
                        {job}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                fullWidth
                select
                variant='outlined'
                label='Gender'
                value={gender}
                onChange={(e) => setGender(e.target.value)}
            >
                <MenuItem value='Male'>Male</MenuItem>
                <MenuItem value='Female'>Female</MenuItem>
            </TextField>
          </Stack>

          <Stack direction='row' spacing={2} sx={{mb:2}}>
            <DatePicker
                label='Birth Date'
                value={birthDate ? dayjs(birthDate) : null}
                onChange={(newValue) => setBirthDate(newValue ? newValue.format('YYYY-MM-DD') : '')}
                maxDate={dayjs(maxDate)}
                slotProps={{
                    textField:{
                        fullWidth: true,
                        variant: 'outlined'
                    }
                }}
            />

            <TextField
                fullWidth
                variant='outlined'
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                slotProps={{
                    htmlInput: {maxLength: 10}
                }}
            />
          </Stack>

          <TextField
            fullWidth
            label='About Me'
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            multiline
            sx={{mb: 2}}
            rows={3}
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
            Sign Up
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
              Already have an account?{' '}
              <span
                style={{color: '#7F77DD', cursor: 'pointer', fontWeight: 600}}
                onClick={() => navigate('/login')}
              >
                Login
              </span>
          </Typography>

        </Box>
      </Box>
    </Box>
  )
}

