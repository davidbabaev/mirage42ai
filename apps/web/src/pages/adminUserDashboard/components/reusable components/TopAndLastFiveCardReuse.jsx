import React, { useState } from 'react'
import getTimeAgo from '../../../../utils/getTimeAgo'
import MediaDisplay from '../../../../components/MediaDisplay'
import { useNavigate } from 'react-router-dom'
import { Avatar, Box, Chip, Typography, useTheme } from '@mui/material';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';

export default function TopAndLastFiveCardReuse({
    topFiveValue, 
    usersArrayValue, 
    mainTitle, 
    showInteractions
}) {

    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(null)
    const theme = useTheme();
    

    return (
        <Box sx={{
            display: 'flex', 
            justifyContent: 'center', 
            flexDirection: 'column'
            
        }}>
            {(topFiveValue || []).map((card) => {
                const cardCreator = usersArrayValue.find(u => u._id === card.userId)

                return(
                    <Box key={card._id}>
                        <Box
                            sx={{
                                display: 'flex',
                                width: '100%',
                                flexDirection: {xs: 'column', md: 'row'},
                                borderBottom: '0.5px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                my: 2,
                                p: 2,
                                gap: 2,
                            }}
                        >
                            <Box sx={{maxWidth: {xs: '100%', md: 250}}}>
                                <MediaDisplay
                                    mediaUrl={card.mediaUrl}
                                    mediaType={card.mediaType}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        borderRadius: 10,
                                        flexShrink: 0
                                    }}
                                />

                            </Box>

                            <Box flex={1}>

                                {/* Title */}
                                {card.title && (
                                    <Typography lineHeight={0.8} component='div' fontWeight={600} fontSize={18} mb={1}>
                                        {card.title}
                                    </Typography>
                                )}


                                <Box sx={{display: 'flex', gap: 1, alignItems: 'center', mb:1}}>

                                    <Avatar 
                                        src={cardCreator?.profilePicture}
                                        sx={{
                                            width: 30, 
                                            height: 30, 
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => navigate(`/profiledashboard/${cardCreator._id}/profilemain`)}
                                    />
                                    <Typography 
                                        component={'div'} 
                                        fontSize={12} 
                                        color='text.secondary' 
                                        lineHeight={0.9} 
                                        onClick={() => navigate(`/profiledashboard/${cardCreator._id}/profilemain`)}
                                        sx={{cursor: 'pointer'}}

                                    >
                                        {cardCreator?.name} {cardCreator?.lastName}
                                    </Typography>

                                    <Typography component={'div'} fontSize={22} color='text.secondary' lineHeight={0.9}>
                                        ∙
                                    </Typography>

                                    <Typography component={'div'} fontSize={12} color='text.secondary' lineHeight={0.9}>
                                        {getTimeAgo(card.createdAt)}
                                    </Typography>

                                    {card.category && (
                                        <Chip 
                                            label={card.category} 
                                            size='small' 
                                        />
                                    )}

                                </Box>

                                {/* Contnet */}
                                {card.content && (
                                    <Typography component='div' fontWeight={400} fontSize={14} mb={1} sx={{whiteSpace: 'pre-wrap'}}>
                
                                        {isExpanded === card._id ? card.content : card.content.slice(0, 150)}
                
                                        {card.content.length > 150 && (
                                            <span
                                                onClick={() => setIsExpanded(isExpanded === card._id ? null : card._id)}
                                                style={{
                                                    color: theme.palette.primary.main, 
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    marginLeft: 4
                
                                                }}
                                            >
                                                {isExpanded === card._id ? '...showless' : '...read more'}
                                            </span>
                                        )}
                
                                    </Typography>
                                )}

                                {showInteractions && (
                                    <Box sx={{display:'flex', gap:3}}>
                                        <Box 
                                            sx={{display:'flex', gap: 1, alignItems: 'center'}}
                                        >
                                            <ChatBubbleIcon 
                                                sx={{color: theme.palette.primary.main, fontSize: 15}}
                                            />
                                            <Typography fontSize={13} color='text.secondary'>
                                                {card.comments.length} Comments
                                            </Typography>
                                        </Box>
                                        <Box 
                                            sx={{display:'flex', gap: 1, alignItems: 'center'}}
                                        >
                                            <ThumbUpIcon 
                                                sx={{color: theme.palette.primary.main, fontSize: 15}}
                                            />
                                            <Typography
                                                fontSize={13}
                                                color='text.secondary'
                                            >
                                                {card.likes.length} Likes
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </Box>
                )
            })}
        </Box>
    )
}
