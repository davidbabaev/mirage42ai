import React, { useMemo, useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useNavigate } from 'react-router-dom';
import useCountries from '../hooks/useCountries';
import useCities from '../hooks/useCities';
import { getAgeByDate, getMaxBirthDate } from '../utils/getAgeByBirthDate';
import { Alert, Autocomplete, Box, Button, Divider, Fade, MenuItem, Stack, Step, StepLabel, Stepper, TextField, Typography, useTheme } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import MirageLogo from '../assets/MirageLogo';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import bgImg from '../assets/Gemini_Generated_Image_ssn5lpssn5lpssn5.png'
import bgImgMobile from '../assets/Gemini_Generated_Image_78keg978keg978ke.png'


const STEPS = ['Account', 'About you', 'Location'];

export default function SignUpPage() {

    const theme = useTheme();

    const [activeStep, setActiveStep] = useState(0);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [gender, setGender] = useState('');
    const [birthDate, setBirthDate] = useState('');

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

    // Validate one step's fields, reusing the original rules/messages.
    // Returns an error string, or null when the step is valid.
    const validateStep = (step) => {
        if(step === 0){
            if(!email.trim().includes('@')){
                return 'email must includes @';
            }
            // Mirror the API's password rule so the form never accepts a
            // password the server will reject: 8+ chars with at least one
            // lowercase, uppercase, digit, and special character.
            if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)){
                return 'Password must be at least 8 characters and include upper & lower case, a number, and a special character';
            }
        }
        if(step === 1){
            if(name.trim() === ''){
                return 'Name is required';
            }
            if(gender === ''){
                return 'Gender is Required';
            }
            if(birthDate === ''){
                return 'Birth date required';
            }
            if(getAgeByDate(birthDate) < 13){
                return 'Age required and must be 13 or older';
            }
        }
        if(step === 2){
            if(country === ''){
                return 'Country is Required';
            }
            if(city === ''){
                return 'City is Required';
            }
        }
        return null;
    }

    const handleNext = () => {
        const stepError = validateStep(activeStep);
        if(stepError){
            setError(stepError);
            return;
        }
        setError('');
        setActiveStep((s) => s + 1);
    }

    const handleBack = () => {
        setError('');
        setActiveStep((s) => s - 1);
    }

    // handle form submit (final step)
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Re-validate every step; jump to the first one that fails.
        for(let s = 0; s < STEPS.length; s++){
            const stepError = validateStep(s);
            if(stepError){
                setActiveStep(s);
                setError(stepError);
                return;
            }
        }

        const calculatedAge = getAgeByDate(birthDate);

        const payload = {
            email: email,
            password: password,
            name: name,
            address: {
                country: country,
                city: city,
            },
            age: calculatedAge,
            gender: gender,
            birthDate: birthDate,
        };
        // Last name is optional; only send it when provided so the API/DB never
        // sees an empty string (the User schema requires min length 2).
        if(lastName.trim()){
            payload.lastName = lastName.trim();
        }

        const result = await handleRegister(payload);

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
            width: '100%',
            maxWidth: 400,
            p: {xs: 3, md: 4},
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

          <Stepper activeStep={activeStep} alternativeLabel sx={{mt: 3}}>
            {STEPS.map((label) => (
                <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                </Step>
            ))}
          </Stepper>

          {/* Step content — height follows the fields so the nav buttons
              sit directly beneath them on every step (no fixed minHeight gap) */}
          <Box sx={{mt: 3, mb: 3}}>
            {activeStep === 0 && (
                <Fade in timeout={250}>
                    <Box>
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
                            variant='outlined'
                        />
                    </Box>
                </Fade>
            )}

            {activeStep === 1 && (
                <Fade in timeout={250}>
                    <Box>
                        <Stack direction='row' spacing={2} sx={{mb: 2}}>
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
                            select
                            variant='outlined'
                            label='Gender'
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            sx={{mb: 2}}
                        >
                            <MenuItem value='Male'>Male</MenuItem>
                            <MenuItem value='Female'>Female</MenuItem>
                        </TextField>

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
                    </Box>
                </Fade>
            )}

            {activeStep === 2 && (
                <Fade in timeout={250}>
                    <Box>
                        <TextField
                            fullWidth
                            select
                            variant='outlined'
                            label='Country'
                            value={country}
                            onChange={handleCountryChange}
                            sx={{mb: 2}}
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

                        <Autocomplete
                            fullWidth
                            options={cities}
                            value={city || null}
                            onChange={(e, newValue) => setCity(newValue || '')}
                            disabled={country === ''}
                            loading={isCitiesLoading}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    variant='outlined'
                                    label='City'
                                />
                            )}
                        />
                    </Box>
                </Fade>
            )}
          </Box>

          {error && (
            <Alert severity='error' sx={{mb: 2}}>
              {error}
            </Alert>
          )}

          {/* Step navigation */}
          <Stack direction='row' spacing={2}>
            {activeStep > 0 && (
                <Button
                    fullWidth
                    variant='outlined'
                    size='large'
                    onClick={handleBack}
                >
                    Back
                </Button>
            )}

            {activeStep < STEPS.length - 1 ? (
                <Button
                    fullWidth
                    variant='contained'
                    size='large'
                    onClick={handleNext}
                >
                    Next
                </Button>
            ) : (
                <Button
                    fullWidth
                    variant='contained'
                    size='large'
                    onClick={handleSubmit}
                >
                    Sign Up
                </Button>
            )}
          </Stack>

          {/* OAuth + login link stay on the first step */}
          {activeStep === 0 && (
            <>
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

              {/* registered link */}
              <Typography fontSize={13} color='text.secondary' textAlign='center'>
                  Already have an account?{' '}
                  <span
                    style={{color: '#7F77DD', cursor: 'pointer', fontWeight: 600}}
                    onClick={() => navigate('/login')}
                  >
                    Login
                  </span>
              </Typography>
            </>
          )}

        </Box>
      </Box>
    </Box>
  )
}
