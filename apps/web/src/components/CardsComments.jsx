import React, { useRef, useState } from 'react'
import { useAuth } from '../providers/AuthProvider';
import { Avatar, Box, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import useFollowUser from '../hooks/useFollowUser';
import getTimeAgo from '../utils/getTimeAgo';
import { useCardsProvider } from '../providers/CardsProvider';
import { useNavigate } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';

export default function CardsComments({card, users, addComment, removeComment, focusRef, closeOnNav}) {

    const [commentText, setCommentText] = useState('');
    const {user: loggedInUser} = useAuth();
    const [commentsCount, setCommentsCount] = useState(5);
    const [isLoading, setIsLoading] = useState(false)
    const {refreshFeed} = useCardsProvider();
    const navigate = useNavigate();
    
    
    const handleSubmit = async (e) => {
        try{
            setIsLoading(true)
            e.preventDefault();
            await addComment(commentText, card._id)
            setCommentText('');
        }
        finally{
            setIsLoading(false)
        }
    }

    const {toggleFollow, isFollowByMe, getFollowingCount, getFollowersCount} = useFollowUser();


    const countedComments = (card?.comments || []).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, commentsCount)

  return (
    <Box sx={{p:1}}>
        {loggedInUser && (
            <Box sx={{display: 'flex', gap: 1, alignItems: 'center', mb: 2}}>
                <Avatar
                    src={loggedInUser.profilePicture}
                    sx={{width: 36, height: 36}}
                />

                <TextField
                    inputRef={focusRef}
                    fullWidth
                    size='small'
                    multiline
                    placeholder='Write your opinion..'
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && commentText.trim() && handleSubmit(e)}
                    sx={{
                        '& .MuiOutlinedInput-root':{
                            borderRadius: 5,
                            fontSize: 13
                        }
                    }}
                />   

                <Button
                    type='submit'
                    variant='contained'
                    loading={isLoading}
                    loadingPosition='start'
                    disabled={!commentText.trim()}
                    sx={{ml: 'auto', borderRadius: 5, minWidth: 90, fontSize: 12}}
                    onClick={handleSubmit}
                    color='primary'
                >
                    {isLoading ? "send.." : "Send"}
                </Button>

                
            </Box>   
        )}

        {/* Comments List */}
        <Box>
            {countedComments.length === 0 && 
                <Typography
                    fontSize={12}
                    color='text.secondary'
                >ther'es no comments yet</Typography>
            }

            {countedComments.map((comment) => {
                const userComment = users.find(u => u._id === comment.userId);

                return(
                    <Box
                        key={comment._id}
                    >

                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                        }}>
                            {/* left avatar + info */}
                            <Box sx={{display: 'flex', gap: 1.5}}>
                                <Avatar
                                    src={userComment?.profilePicture}
                                    sx={{cursor: 'pointer', width: 36, height: 36}}
                                    onClick={() => {
                                        navigate(`/profiledashboard/${userComment?._id}/profilemain`)
                                        closeOnNav()
                                }}
                                />
            
                                <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5}}>
                                    <Typography component={'div'} fontWeight={600} fontSize={14} lineHeight={1.2}>
                                        {userComment?.name} {userComment?.lastName}
                                        <Typography 
                                            component='span' 
                                            color='text.secondary'
                                            fontSize={11}
                                            fontWeight={400}
                                        >
                                            {isFollowByMe(userComment?._id) && ' · following'}
                                        </Typography>
                                    </Typography>
            
                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {userComment?.job}
                                    </Typography>
            
                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {getFollowersCount(userComment?._id)} followers · {getTimeAgo(comment.createdAt)}
                                    </Typography>
            
                                </Box>
                            </Box>
            
            
                         <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                            {/* Right: Follow button */}

                            {loggedInUser && loggedInUser._id !== userComment?._id && !isFollowByMe(userComment?._id) &&(
                                <Button
                                    size='small'
                                    variant={'outlined'}
                                    startIcon={<PersonAddIcon/>}
                                    onClick={async () => {
                                        await toggleFollow(userComment?._id)
                                        await refreshFeed();
                                    }}
                                    sx={{fontSize: 9, minWidth: 70, borderRadius: 5, py: 0.3,
                                        '& .MuiButton-startIcon' : {mb: 0.2}, lineHeight: 0 
                                    }}
                                >
                                    Follow
                                </Button>
                            )}

                            {loggedInUser && 
                                (loggedInUser._id === comment.userId || loggedInUser._id === card.userId || loggedInUser.isAdmin
                            ) && (
                                <Tooltip title="Delete Comment">
                                    <IconButton 
                                        size='small'
                                        onClick={() => removeComment(card._id, comment._id)}
                                        sx={{border: '1px solid', borderColor: 'text.secondary'}}
                                    >
                                        <DeleteIcon sx={{fontSize: 14}}/>
                                    </IconButton>
                                </Tooltip>
                            )
                            }
                        </Box>


                        </Box>

                        <Box sx={{mb: 2, pl: 6, mt:1}}>
                            <Typography sx={{fontSize: 14, lineHeight: 1.2, whiteSpace: 'pre-wrap'}}>
                                {comment.commentText}
                            </Typography>
                        </Box>

                    </Box>
                )
            })}

            {commentsCount <= (card?.comments || []).length && (
                    <Button 
                        size='small'
                        sx={{
                            fontSize: 11,
                            border: '1px solid',
                            borderRadius: 5,
                            px:2
                        }}
                        onClick={() => setCommentsCount(commentsCount + 5)}
                    >
                        Read More..
                    </Button>
            )}
        </Box>

    </Box>
  )
}
