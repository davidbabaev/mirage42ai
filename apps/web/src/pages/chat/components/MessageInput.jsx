import { Box, IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import MediaDisplay from '../../../components/MediaDisplay';
import EmojiPicker from 'emoji-picker-react';

// Bottom composer: optional media preview, attach buttons, text field, emoji, send.
export default function MessageInput({
    messageText,
    setMessageText,
    onSend,
    mediaFile,
    setMediaFile,
    previewMedia,
    fileInputRef,
    isEmojiOpen,
    setIsEmojiOpen,
    onEmojiClick,
}) {
    return (
        <>
            {/* media preview */}
            {previewMedia && (
                <Box sx={{position: 'relative', m:1}}>
                    {/* Floating Buttons over image */}
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 0.5,
                            position: 'absolute',
                            left: 5,
                            top: 5,
                            zIndex: 1000
                        }}>
                        <Tooltip title = "Remove Media">
                            <IconButton
                                onClick={() => {
                                    setMediaFile(null);
                                    fileInputRef.current.value = '';
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
                    </Box>

                    <MediaDisplay
                        mediaType={mediaFile.type.startsWith('video/') ? 'video' : 'image'}
                        mediaUrl={previewMedia}
                        style={{
                            maxWidth: 200,
                            maxHeight: 150,
                            borderRadius: '10px',
                            objectFit: 'cover',
                            display: 'block'
                        }}
                    />
                </Box>
            )}

            {/* Bottom: text input + send button */}
            <Box
                sx={{
                    p: 2,
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    borderTop: '0.5px solid',
                    borderColor: 'divider'
                }}
            >
                <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*,video/*'
                    onChange={(e) => setMediaFile(e.target.files[0])}
                    style={{display: 'none'}}
                />

                <IconButton
                    sx={{p:0.3}}
                    onClick={() => {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                    }}
                >
                    <ImageIcon sx={{color: 'text.secondary'}}/>
                </IconButton>

                <IconButton
                    sx={{p:0.3}}
                    onClick={() => {
                        fileInputRef.current.accept = 'video/*';
                        fileInputRef.current.click();
                    }}
                >
                    <VideocamIcon sx={{color: 'text.secondary'}}/>
                </IconButton>

                <TextField
                    fullWidth
                    size='small'
                    multiline
                    maxRows={10}
                    placeholder='Write a message...'
                    onChange={(e) => setMessageText(e.target.value)}
                    value={messageText}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter' && !e.shiftKey && messageText.trim()){
                            e.preventDefault()
                            onSend()
                        }}
                        }
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment
                                    position='start'
                                    sx={{
                                        alignSelf: 'flex-end',
                                        cursor: 'pointer',
                                        display: {xs: 'none', md: 'flex'}
                                    }}
                                >
                                    <IconButton onClick={() => {
                                        setIsEmojiOpen(!isEmojiOpen)
                                    }}>
                                        <EmojiEmotionsIcon/>
                                    </IconButton>
                                </InputAdornment>
                            )
                        }
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 5,
                            fontSize: 15,
                            bgcolor: 'action.hover',
                            '& fieldset': {border: 'none'}
                        }
                    }}
                />
                {isEmojiOpen && (
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
                )}
                <IconButton
                    disabled={!messageText.trim() && !mediaFile}
                    onClick={onSend}
                    sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        flexShrink: 0,
                        '&:hover': {
                            bgcolor: 'primary.dark'
                        },
                        '&.Mui-disabled': {bgcolor: 'action.disabledBackground'}
                    }}
                >
                    <SendIcon/>
                </IconButton>
            </Box>
        </>
    );
}
