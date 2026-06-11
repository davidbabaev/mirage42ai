import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../providers/AuthProvider';
import useCountries from '../../hooks/useCountries';
import { JOB_INDUSTRIES } from '../../constants/usersJobIndustries';
import useCities from '../../hooks/useCities';
import { getMaxBirthDate, getAgeByDate } from '../../utils/getAgeByBirthDate';
import { useLocation } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Container, Grid, IconButton, InputAdornment, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import EmojiPicker from 'emoji-picker-react';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';


export default function ProfileSection({editMode ,onEditMode, onCloseEdit}) {

    const {user, editUser} = useAuth(); // only works for registered
    const {apiCountriesList} = useCountries(); 
    
    // edit logged-in user values states:
    const [editName, setEditName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editCountry, setEditCountry] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editprofilePicture, setEditprofilePicture] = useState('');
    const [editCoverImage, setEditCoverImage] = useState('');
    const [editAge, setEditAge] = useState('');
    const [editJob, setEditJob] = useState('');
    const [editGender, setEditGender] = useState('');
    const [editBirthDate, setEditBirthDate] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editAboutMe, setEditAboutMe] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const fileInputRef = useRef(null);
    const fileCoverImgInputRef = useRef(null);
    const [error, setError] = useState('');

    const maxDate = useMemo(() => getMaxBirthDate(13), []);

    const handleCountryChange = (e) => {
        setEditCountry(e.target.value);
        setEditCity('');
    }

    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const onEmojiClick = (emojiData) => {
        setEditAboutMe(prev => prev + emojiData.emoji);
        setIsEmojiOpen(false);
    }

    const previewProfilePicture = useMemo(() => {
        if(editprofilePicture instanceof File){
            return URL.createObjectURL(editprofilePicture)
        }
        else if(typeof editprofilePicture === 'string'){
            return editprofilePicture
        }
        else{
            return null
        }
    }, [editprofilePicture])

    const previewCoverImage = useMemo(() => {
        if(editCoverImage instanceof File){
            return URL.createObjectURL(editCoverImage)
        }
        else if(typeof editCoverImage === 'string'){
            return editCoverImage
        }
        else{
            return null
        }
    }, [editCoverImage])

    const userData = [
        {label: 'Email' , value: user.email},
        {label: 'Phone' , value: user.phone},
        {label: 'Country' , value: user.address?.country},
        {label: 'City' , value: user.address?.city},
        {label: 'Age' , value: user.age},
        {label: 'Job' , value: user.job},
        {label: 'Gender' , value: user.gender},
        {label: 'Birth Date' , value: user.birthDate?.split("T")[0]},
        {label: 'Joined to Mirage' , value: user.createdAt?.split("T")[0]},
    ]

    const {cities, isCitiesLoading} = useCities(editCountry);
    
    // the state will be the data object you passed {editMode: true}
    const location = useLocation();
    const {state} = location;
    useEffect(() => {
        if(state?.editMode === true){
            onEditMode();
            setEditName(user.name);
            setEditLastName(user.lastName);
            setEditEmail(user.email);
            setEditCountry(user.address?.country === 'Not Defined' ? '' : user.address?.country);
            setEditCity(user.address?.city);
            setEditprofilePicture(user.profilePicture);
            setEditCoverImage(user.coverImage);
            setEditJob(user.job);
            setEditAge(user.age)
            setEditGender(user.gender);
            setEditBirthDate(user.birthDate?.split("T")[0]);
            setEditPhone(user.phone);
            setEditAboutMe(user.aboutMe);
        }
    }, [state])

    useEffect(() => {
        if(editMode === true){
            setEditName(user.name);
            setEditLastName(user.lastName);
            setEditEmail(user.email);
            setEditCountry(user.address?.country);
            setEditCity(user.address?.city);
            setEditprofilePicture(user.profilePicture);
            setEditCoverImage(user.coverImage);
            setEditJob(user.job);
            setEditAge(user.age)
            setEditGender(user.gender);
            setEditBirthDate(user.birthDate?.split("T")[0]);
            setEditPhone(user.phone);
            setEditAboutMe(user.aboutMe);
        }
    }, [editMode])

    
    const countryMenuItems = useMemo(() => {
        return apiCountriesList.map((country, index) => (
            <MenuItem 
                key={country.code} 
                value={country.name}
            >
                {country.name}
            </MenuItem>
        ))
    }, [apiCountriesList])

    const citiesMenuItems = useMemo(() => {
        return cities.map((cityApi) => (
            <MenuItem 
                key={cityApi} 
                value={cityApi}
            >
                {cityApi}
            </MenuItem>
        ))
    }, [cities])

    const jobsMenuItems = useMemo(() => {
        return JOB_INDUSTRIES.map((job) => (
            <MenuItem 
                key={job} 
                value={job}
            >
                {job}
            </MenuItem>
        ))
    }, [])

    if(!user) return <OnLoadingSkeletonBox/>

return (
<Box mb={2}>
    {!editMode ? (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column'
            }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        mt: 2,
                        p: 3,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Typography fontSize={20} fontWeight={700} pb={1}>
                        About            
                    </Typography>
                    <Typography fontSize={15} sx={{lineHeight: 1.2, whiteSpace: 'pre-wrap'}}>
                        {user.aboutMe}            
                    </Typography>
                </Paper>

                <Paper
                    elevation={0}
                    sx={{
                        mt: 2,
                        p: 3,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        flexWrap: 'wrap',
                    }}
                >
                    {userData.map((data, index) => (
                        <Box key={index} sx={{display: 'flex', width: '50%',}}>
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                py: 1,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                width: '100%',
                            }}>
                                <Typography fontSize={14} color='text.secondary'>
                                    {data.label}            
                                </Typography>
                                <Typography fontSize={15} fontWeight={700}>
                                    {data.value}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Paper>
            <hr />
        </Box>

    ): (
        <Box 
            sx={{
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    mt: 2,
                    p: {xs: 1, md:3},
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider'
                }}
            >

                <input 
                    ref={fileCoverImgInputRef}
                    type="file"
                    accept='image/*' 
                    onChange={(e) => setEditCoverImage(e.target.files[0])}
                    style={{display: 'none'}}
                />

                <Box sx={{position: 'relative', mb: 4}}>

                    <Typography fontWeight={700} fontSize={18}>
                        Banner image
                    </Typography>

                    <Typography color='text.secondary' fontSize={14} mb={1}>
                        This image will appear across the top of your profile
                    </Typography>

                    <Box
                        onClick = {() => fileCoverImgInputRef.current.click()}
                        sx={{
                            width: '100%',
                            height: 230,
                            borderRadius: 4,
                            backgroundImage: `url(${previewCoverImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            cursor: 'pointer'
                        }}       
                    />

                    <IconButton
                        onClick={() => fileCoverImgInputRef.current.click()}
                        sx={{
                            position: 'absolute',
                            bottom: -10,
                            right: 15,
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            p:0.5,
                            '&:hover': {
                                bgcolor: 'background.paper'
                            }
                        }}
                    >
                        <EditIcon fontSize='small'/>
                    </IconButton>
                </Box>

                <input 
                    ref={fileInputRef}
                    type="file" 
                    accept='image/*'
                    onChange={(e) => setEditprofilePicture(e.target.files[0])}
                    style={{display: 'none'}}
                />

                <Box mb={4}>
                    <Typography fontWeight={700} fontSize={18}>
                        Profile picture
                    </Typography>

                    <Typography color='text.secondary' fontSize={14} mb={1}>
                        Your profile picture will appear where your profile is presented on Mirage, like next to your media and comments
                    </Typography>
                    <Box sx={{position: 'relative', width: 'fit-content', mb:2}}>
                        <Avatar 
                            onClick={() => fileInputRef.current.click()}
                            src={previewProfilePicture}
                            sx={{
                                width: 100, 
                                height: 100, 
                                cursor: 'pointer'
                            }}
                        />
                        <IconButton
                            onClick={() => fileInputRef.current.click()}
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                bgcolor: 'background.paper',
                                border: '1px solid',
                                borderColor: 'divider',
                                p:0.5,
                                '&:hover': {
                                    bgcolor: 'background.paper'
                                }
                            }}
                        >
                            <EditIcon fontSize='small'/>
                        </IconButton>

                    </Box>
                </Box>


                
                <Typography fontWeight={700} fontSize={18}>
                    About me
                </Typography>

                <Typography color='text.secondary' fontSize={14} mb={1}>
                    Tell people about who you are
                </Typography>

                <Paper
                    elevation={0}
                    sx={{
                        p: {xs: 1, md:2},
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >

                    <TextField 
                        fullWidth
                        multiline
                        minRows={6}
                        maxRows={13}
                        placeholder='About me...'
                        value={editAboutMe}
                        onChange={(e) => setEditAboutMe(e.target.value)}
                        variant='standard'
                        sx={{
                            // p: 1,
                            '& .MuiInput-input::placeholder': {
                                fontSize: 15,
                                color: 'text.secondary'
                            },
                            '& .MuiInput-input': {
                                fontSize: 16,
                                // color: 'text.secondary'
                            },
                            color: 'text.secondary',
                            '& .MuiInput-underline:before' : {borderBottom: 'none'},
                            '& .MuiInput-underline:after' : {borderBottom: 'none'},
                            '& .MuiInput-underline:hover:before' : {borderBottom: 'none'},
                            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                        }}
                        slotProps={{
                            input : {
                                endAdornment: (
                                    <InputAdornment 
                                        position='end' sx={{alignSelf: 'flex-end'}}>
                                        <Box display={{xs: 'none', md: 'flex'}}>
                                            <IconButton 
                                                onClick={() => setIsEmojiOpen(!isEmojiOpen)}>
                                                <EmojiEmotionsIcon/>
                                            </IconButton>
                                        </Box>
                                    </InputAdornment>
                                )
                            }
                        }}
                    />

                </Paper>
    
                {isEmojiOpen && 
                    <Box style={{position: 'fixed',  bottom: '80px', left: '50%',zIndex: 1050, transform: 'translateX(-50)'}}>
                        <EmojiPicker  
                            onEmojiClick={onEmojiClick}
                        />
                    </Box>
                }

                {/* Name Row */}
                <Stack direction={{xs: 'column',md:'row'}} spacing={2} sx={{ mt: 3, mb: 2}}>
                    <TextField
                        fullWidth
                        variant='outlined'
                        label='First Name'
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder= {editName}
                    />
                    
                    <TextField
                        fullWidth
                        variant='outlined'
                        label='Last Name'
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        placeholder={editLastName}
                    />
                </Stack>

                <TextField
                    fullWidth
                    variant='outlined'
                    disabled
                    label='Email'
                    type='email'
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder={editEmail}
                    autoComplete='off'
                    sx={{mb: 2}}
                />
            

                <Stack direction={{xs: 'column',md:'row'}} spacing={2} sx={{mb: 2}}>
                    <TextField
                        fullWidth
                        select
                        variant='outlined'
                        label='Country'
                        value={editCountry}
                        onChange={handleCountryChange}
                    >
                        {countryMenuItems}
                    </TextField>

                    <TextField
                        fullWidth
                        select
                        variant='outlined'
                        label='City'
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        disabled={editCountry === '' || isCitiesLoading}
                    >
                        {citiesMenuItems}
                    </TextField>
                </Stack>

                <Stack direction={{xs: 'column',md:'row'}} spacing={2} sx={{mb:2}}>
                <TextField
                    fullWidth
                    select
                    variant='outlined'
                    label='Job Industry'
                    value={editJob}
                    onChange={(e) => setEditJob(e.target.value)}
                >
                    {jobsMenuItems}
                </TextField>
    
                <TextField
                    fullWidth
                    select
                    variant='outlined'
                    label='Gender'
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                >
                    <MenuItem value='Male'>Male</MenuItem>
                    <MenuItem value='Female'>Female</MenuItem>
                </TextField>
                </Stack>

                <Stack direction={{xs: 'column',md:'row'}} spacing={2} sx={{mb:2}}>
                    <Box sx={{flex: 1}}>
                        <DatePicker
                            label='Birth Date'
                            value={editBirthDate ? dayjs(editBirthDate) : null}
                            onChange={(newValue) => setEditBirthDate(newValue ? newValue.format('YYYY-MM-DD') : '')}
                            maxDate={dayjs(maxDate)}
                            slotProps={{
                                textField:{
                                    fullWidth: true,
                                    variant: 'outlined'
                                }
                            }}
                        />
                        <Typography color='text.secondary' fontSize={13}>
                            You must be at least 13+ years old
                        </Typography>
                    </Box>

                    <TextField
                        sx={{flex: 1}}
                            fullWidth
                            variant='outlined'
                            label="Phone"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            slotProps={{
                              htmlInput: {maxLength: 10}
                        }}
                    />
                </Stack>

                <Box sx={{display: 'flex', gap: 1}}>
                        <Button
                            variant='contained'
                            sx={{
                                borderRadius: 5
                            }}
                            disabled={!(editName?? '').trim() || !(editLastName ?? '').trim()}
                            onClick={async() => {
                                if(editCountry === ''){
                                    setError('Country is required')
                                    return;
                                }
                                if(editCity === 'Not Defined' || editCity === ''){
                                    setError('City is required')
                                    return;
                                }
                                const formData = new FormData();
                                formData.append('name', editName);
                                formData.append('lastName', editLastName);
                                formData.append('email', user.email);
                                formData.append('address[country]', editCountry);
                                formData.append('address[city]', editCity);
                                formData.append('profilePicture', editprofilePicture);
                                formData.append('coverImage', editCoverImage);
                                formData.append('age', getAgeByDate(editBirthDate));
                                formData.append('gender', editGender);
                                formData.append('phone', editPhone);
                                formData.append('job', editJob);
                                formData.append('birthDate', editBirthDate);
                                formData.append('aboutMe', editAboutMe);

                                const result = await editUser(user._id, formData);

                                if(result.success){
                                    onCloseEdit();
                                } else{
                                    setError(result.message)
                                }
                            }}
                        >
                            Save changes
                        </Button>

                        <Button
                            variant='outlined'
                            sx={{
                                borderRadius: 5
                            }}
                            onClick={() => onCloseEdit()}
                        >
                            Discard
                        </Button>
                        {error && (
                            <Alert severity='error' sx={{mb:2}}>
                                {error}
                            </Alert>
                        )}
                </Box>

            </Paper>
        </Box>
    )}
</Box>
)
}
