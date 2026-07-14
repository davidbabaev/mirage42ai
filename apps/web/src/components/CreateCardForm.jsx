import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CARD_CATEGORIES } from '../constants/cardsCategories';
import { useCardsProvider } from '../providers/cardsContext';
import EmojiPicker from 'emoji-picker-react';
import MediaDisplay from './MediaDisplay';
import { Alert, Avatar, Box, Button, CircularProgress, IconButton, Input, InputAdornment, MenuItem, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { useAuth } from '../providers/authContext';
import MovieIcon from '@mui/icons-material/Movie';
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import AddLinkIcon from '@mui/icons-material/AddLink';
import TitleIcon from '@mui/icons-material/Title';
import { useNavigate } from 'react-router-dom';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import CategoryIcon from '@mui/icons-material/Category';

// Verify a selected file is a real, decodable image/video before we let the
// user post it. A corrupt file (or a non-image renamed to .png) passes the
// "a file was chosen" check but renders as a broken image in the feed — we
// reject it here so a post can never ship without valid media.
function validateMediaFile(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const cleanup = () => URL.revokeObjectURL(url);
        if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => { cleanup(); resolve(true); };
            video.onerror = () => { cleanup(); resolve(false); };
            video.src = url;
        } else {
            const img = new Image();
            img.onload = () => { cleanup(); resolve(img.naturalWidth > 0 && img.naturalHeight > 0); };
            img.onerror = () => { cleanup(); resolve(false); };
            img.src = url;
        }
    });
}

export default function CreateCardForm({onSuccess, mediaButton, card}) {

    const [title, setTitle] = useState(card?.title || '');
    const [text, setText] = useState(card?.content || '');
    const [mediaFile, setMediaFile] = useState(card?.mediaUrl || null);
    const [category, setCategory] = useState(card?.category || '');
    const [webUrl, setWebUrl] = useState(card?.web || '');

    const previewMedia = useMemo(() => {
        if(mediaFile instanceof File){
            return URL.createObjectURL(mediaFile)
        }
        else if(typeof mediaFile === 'string'){
            return mediaFile
        }
        else{
            return null
        }
    }, [mediaFile])


    const [error, setError] = useState('');
    const [, setSuccessMessage] = useState('');
    const {handleCardRegister, handleEditCard} = useCardsProvider();
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingMedia, setIsCheckingMedia] = useState(false);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const fileInputRef = useRef(null);

    const [isTitleOn, setIsTitleOn] = useState(card?.title ? true : false);
    const [isLinkFieldShown, setIsLinkFieldShown] = useState(card?.web ? true : false);
    const [isCategoryOpen, setIsCategoryOpen] = useState(card?.category ? true : false);

    const {user} = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if(mediaButton){
            fileInputRef.current.accept = mediaButton === 'image' ? 'image/*' : 'video/*';
            fileInputRef.current.click();
        }
    }, [])

    const theme = useTheme();

    const onEmojiClick = (emojiData) => {
        setText(prev => prev + emojiData.emoji);
        setIsEmojiOpen(false);
    }

    // Validate the chosen file before accepting it as the post's media.
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file after a rejection
        if (!file) return;
        setError('');
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            setMediaFile(null);
            setError('Unsupported file type. Please choose an image or video.');
            return;
        }
        setIsCheckingMedia(true);
        const isValid = await validateMediaFile(file);
        setIsCheckingMedia(false);
        if (!isValid) {
            setMediaFile(null);
            setError(
                file.type.startsWith('video/')
                    ? "This video is broken and can't be added. Please choose a different file."
                    : "This image is broken and can't be added to your post. Please choose a valid image — a post can't be published without working media."
            );
            return;
        }
        setMediaFile(file);
    }

    const noUnderlineSx = {
        '& .MuiInput-underline:before': { borderBottom: 'none' },
        '& .MuiInput-underline:after': { borderBottom: 'none' },
        '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
    }

    const handleSubmitNewCard = async (e) => {
        e.preventDefault();

        setError('');
        setSuccessMessage('');
        
        if(text.trim() === ''){
            setError('Text is required')
            return;
        }
        
        if(!mediaFile){
            setError('You must choose media')
            return;
        }
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', text);
        formData.append('category', category);
        formData.append('web', webUrl);
        formData.append('media', mediaFile);
        
        try{
            setIsLoading(true); // start is loading
            let result;
            if(!card){
                result = await handleCardRegister(formData)
            } else{
                result = await handleEditCard(card._id,formData) 
            }
            if(!result.success){
                setError(result.message)// show error to user
                return;
            }
            
            setText('');
            setTitle('');
            setMediaFile(null);
            fileInputRef.current.value = '';
            setCategory('');
            setWebUrl('');
            setSuccessMessage(card ? 'Card updated successfully' : 'Your card created successfully')
            setIsLinkFieldShown(false)
            
            // then hand control back to parent
            onSuccess();
        }
        finally{
            setIsLoading(false);
        }
  
    }

return (
    <Box 
        component="form" 
        onSubmit={handleSubmitNewCard}
        sx={{
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            '& input:-webkit-autofill': {
                // theme.palette.background.paper
                // reads the actual color value from the theme, switches automatically between dark/light
                // theme.palette.text.primary: same for text color
                WebkitBoxShadow: `0 0 0 1000px ${theme.palette.background.paper} inset`,
                WebkitTextFillColor: theme.palette.text.primary,
                transition: 'background-color 5000s ease-in-out 0s'
            }
        }}
    >
        {/* // Top: Avatar + User Info */}
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2
        }}>
            <Avatar 
                onClick={() => navigate(`/profiledashboard/${user?._id}/profilemain`)} 
                src={user?.profilePicture}
                sx={{cursor: 'pointer'}}
            />
            <Box>
                <Typography fontWeight={600} fontSize={14} color='text.primary'>
                    {user?.name} {user?.lastName}
                </Typography>
                <Typography fontSize={12} color='text.secondary'>
                    Post to Anyone
                </Typography>
            </Box>

        </Box>

        <Box sx={{flex: 1, overflowY: 'auto', minHeight: 0}}>
            {/* Title Field - toggle */}
            {isTitleOn && (
                <TextField
                    fullWidth
                    placeholder='Title'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    variant='standard'
                    sx={{
                        mb: 1,
                        '& .MuiInput-input::placeholder': {
                            fontSize: 20,
                            color: 'text.secondary'
                        },
                        '& .MuiInput-input': {
                            fontSize: 20,
                            color: 'text.secondary'
                        },
                        ...noUnderlineSx
                    }}
        
                    slotProps={{
                    input: {
                        startAdornment:(
                            <InputAdornment position='start'>
                                <TitleIcon fontSize='large'/>
                            </InputAdornment>
                        )
                    }
                }}   
                />
            )}

            {/* text area */}
            <TextField 
                fullWidth
                multiline
                minRows={6}
                placeholder='What on your mind?'
                value={text}
                onChange={(e) => {
                    setText(e.target.value)
                    setError('')
                }}
                variant='standard'
                sx={{
                    p: 1,
                    flex: {xs:1, md:'none'},
                    '& .MuiInputBase-root': {
                        height: {xs: '100%', md: 'auto'},
                        alignItems: 'flex-start'
                    },
                    '& .MuiInput-input::placeholder': {
                        fontSize: 15,
                        color: 'text.secondary'
                    },
                    '& .MuiInput-input': {
                        fontSize: 15,
                        color: 'text.secondary',
                        overflow: {xs: 'auto', md: 'visible'}
                    },
                    color: 'text.secondary',
                    '& .MuiInput-underline:before' : {borderBottom: 'none'},
                    '& .MuiInput-underline:after' : {borderBottom: 'none'},
                    '& .MuiInput-underline:hover:before' : {borderBottom: 'none'},
                    '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                }}
            />

            {/* URL */}
            {isLinkFieldShown && (
                    <Box>
                        <TextField 
                            fullWidth
                            size='small'
                            type="url"
                            value={webUrl}
                            onChange={(e) => {
                                setWebUrl(e.target.value);
                                setError('');
                            }}
                            placeholder='Add a URL...'
                            variant='standard'
                            sx={{
                                mt: 1,
                                mb: 1,                            
                                '& .MuiInput-input::placeholder': {
                                    fontSize: 14,
                                    color: 'text.secondary'
                                },
                                '& .MuiInput-input': {
                                    fontSize: 14,
                                    color: 'text.secondary'
                                },
                                ...noUnderlineSx,
                            }}

                            slotProps={{
                                input: {
                                    startAdornment:(
                                        <InputAdornment position='start'>
                                            <AddLinkIcon fontSize='small'/>
                                        </InputAdornment>
                                    )
                                }
                            }}      
                        />
                    </Box>
            )}

            {/* Category */}
            {isCategoryOpen && (
                <Box>
                    <TextField
                        fullWidth
                        select
                        size='small'
                        value={category}
                        onChange={(e) => {
                            setCategory(e.target.value);
                            setError('');
                        }}
                        variant='standard'
                        sx={{
                            mt: 1,
                            mb: 1,                            
                            '& .MuiInput-input::placeholder': {
                                fontSize: 14,
                                color: 'text.secondary'
                            },
                            '& .MuiInput-input': {
                                fontSize: 14,
                                color: 'text.secondary'
                            },
                            ...noUnderlineSx,
                        }}

                        slotProps={{
                            select: {
                                startAdornment:(
                                <InputAdornment position='start'>
                                    <CategoryIcon fontSize='small'/>
                                </InputAdornment>
                                ),
                                displayEmpty: true,
                                renderValue: (value) => value || 'Select a category..'
                            }
                        }} 
                    >
                        <MenuItem value='' disabled>No Category</MenuItem>
                        {CARD_CATEGORIES.map((category) => (
                            <MenuItem key={category} value={category}>{category}</MenuItem>
                        )
                        )}  
                    </TextField>
                </Box>
            )}

            {/* media preview */}   
            {previewMedia && (
                <Box sx={{position: 'relative', mt: 1, mb:1}}>
                    
                    {/* Floating Buttons over image */}
                    <Box 
                        sx={{
                            display: 'flex', 
                            gap: 0.5,
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 1000
                        }}>
                        <Tooltip title = "Remove Media">
                            <IconButton 
                                onClick={() => {
                                    setMediaFile(null);
                                    fileInputRef.current.value = '';
                                    setError('');
                                }}
                                sx={{
                                    color: 'white',
                                    bgcolor: 'rgba(0,0,0,0.4)',
                                    borderRadius: 3,
                                    p: 0.5
                                }}
                            >
                                    <CloseIcon/>
                            </IconButton>
                        </Tooltip>

                        <Tooltip title = "Edit">
                            <IconButton 
                                onClick={() => {
                                    fileInputRef.current.click()
                                    setError('')
                                }}
                                sx={{
                                    color: 'white',
                                    bgcolor: 'rgba(0,0,0,0.4)',
                                    borderRadius: 3,
                                    p: 0.5
                                }}
                            >
                                    <EditIcon/>
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <MediaDisplay
                        mediaUrl={previewMedia}
                        mediaType={mediaFile instanceof File ? mediaFile.type.startsWith('video/') ? 'video' : 'image' : card?.mediaType}
                        style={{width: '100%', borderRadius: '10px'}}
                        onError={() => {
                            setMediaFile(null);
                            setError("This image is broken and can't be added to your post. Please choose a valid image.");
                        }}
                    />
                </Box>
            )}

            {/* Media validation in progress */}
            {isCheckingMedia && (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary'}}>
                    <CircularProgress size={16}/>
                    <Typography fontSize={13}>Checking media…</Typography>
                </Box>
            )}

            {/* Error */}
            {error && (
            <Alert severity='error' sx={{mb: 2}}>
                {error}
            </Alert>
            )}
        </Box>

        {/* toolbar */}
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            // gap: 1,
            mt: 'auto',
            pt: 1,
            borderTop: {xs: '1px solid', md: 'none'},
            borderColor: 'divider',
        }}>

            <input 
                ref={fileInputRef}
                type="file"
                accept = {'image/*,video/*'}
                onChange={handleFileSelect}
                style={{display: 'none'}}
            />

            {!previewMedia && (
                <Tooltip title = "Add Photo/Video">
                    <IconButton onClick={() => {
                            fileInputRef.current.accept = 'image/*,video/*';
                            fileInputRef.current.click()
                            setError('')
                        }} sx={{ display:'flex', gap: 1, borderRadius: 5}}>
                        <InsertPhotoIcon/>
                        <Typography sx={{
                            borderRight: '0.5px solid',
                            borderColor: 'text.secondary', 
                            height: '20px',
                            }}/>
                        <MovieIcon/>
                    </IconButton>
                </Tooltip>
            )}

            <Tooltip title = "Emoji">
                <IconButton 
                    onClick={() => setIsEmojiOpen(!isEmojiOpen)}
                    sx={{display: {xs: 'none', md: 'flex'}}}
                >
                    <EmojiEmotionsIcon/>
                </IconButton>
            </Tooltip>

            {isEmojiOpen && 
                <Box sx={{
                    position: 'fixed',  
                    bottom: '80px', 
                    left: {xs: 0,md:'50%'},
                    zIndex: 1050, 
                    transform: 'translateX(-50)', 
                    display: {xs: 'none', md: 'block'
                }}}>
                    <EmojiPicker  
                        onEmojiClick={onEmojiClick}
                    />
                </Box>
            }

            <Tooltip title = "Add Link">
                <IconButton onClick={() => {
                        setIsLinkFieldShown(!isLinkFieldShown)
                        isLinkFieldShown && setWebUrl('')
                        setError('')
                    }}>
                    <AddLinkIcon/>
                </IconButton>
            </Tooltip>

            <Tooltip title = "Add Category">
                <IconButton onClick={() => {
                        setIsCategoryOpen(!isCategoryOpen)
                        isCategoryOpen && setCategory('')
                        setError('')
                    }}>
                    <CategoryIcon/>
                </IconButton>
            </Tooltip>

            <Tooltip title = "Add Title">
                <IconButton onClick={() => {
                        setIsTitleOn(!isTitleOn)
                        isTitleOn && setTitle('')
                    }}>
                    <TitleIcon/>
                </IconButton>
            </Tooltip>


            <Button
                type='submit'
                variant='contained'
                loading={isLoading}
                loadingPosition='start'
                // startIcon={<AutorenewIcon/>}
                disabled={!text || !mediaFile || isCheckingMedia}
                sx={{ml: 'auto', borderRadius: 5, minWidth: 90}}
            >
                {isLoading ? (card ? 'Saving..' : 'Posting..') : (card ? 'Save' : 'Post')}
            </Button>

        </Box>

    </Box>
  )
}
