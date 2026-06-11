import React, { useMemo, useState } from 'react'
import { useCardsProvider } from '../providers/CardsProvider'

import useDebounce from '../hooks/useDebounce';
import useFavoriteCards from '../hooks/useFavoriteCards';
import { CARD_CATEGORIES } from '../constants/cardsCategories';
import SearchIcon from '@mui/icons-material/Search';
import { Avatar, Box, Button, Checkbox, Chip, Container, Grid, IconButton, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import CardItem from '../components/CardItem';
import CardPopupModal from '../components/card/CardPopupModal';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useUsersProvider } from '../providers/UsersProvider';


export default function AllCardsPage() {

    // control filter cards by creator
    const [creatorId, setCreatorId] = useState('')
    
    // search cards by title/ text
    const [searchCard, setSearchCard] = useState('')
    
    const debounceSearchCard = useDebounce(searchCard, 2000);
    
    // sort cards (newest/ oldest)
    const [dateSort, setDateSort] = useState('');
    
    // favorite/ like cards
    const [favorites, setFavorites] = useState('')
    
    // card categories/ tags
    const [categoriesFilter, setCategoriesFilter] = useState([]);
    
    const [openCommentCardId, setOpenCommentCardId] = useState(null);
    const [selectedCardId, setSelectedCardId] = useState(null);

    // Mobile:
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    

    // controls the search input for users
    const [creatorSearch, setCreatorSearch] = useState('')
    
    const {registeredCards} = useCardsProvider();
    const [count, setCount] = useState(10);
    const {users} = useUsersProvider(); 
    const {favoriteCards ,handleFavoriteCards, handleRemoveCard} = useFavoriteCards();

    const [showAllCategories, setShowAllCategories] = useState(false)
    
    const handleCategoryToggle = (category) => {
        setCategoriesFilter((prev) => {
            const include = prev.includes(category)
            if(!include){
                return [...prev, category]
            }

            return prev.filter(cat => cat !== category)
        })
    }

    const SORT_OPTIONS = [
        {label: 'Default', value: ''},
        {label: 'Newest', value: 'newest'},
        {label: 'Oldest', value: 'oldest'},
        {label: 'Most Liked', value: 'most liked'},
        {label: 'Most Commented', value: 'most commented'},
    ]

    const filterCreators = users.filter((user) => (user.name + ' ' + user.lastName).toLowerCase().includes(creatorSearch.toLowerCase()))

    const handleClearAllFilters = () => {
        setCreatorId('');
        setSearchCard('');
        setDateSort('');
        setFavorites('');
        setCategoriesFilter([]);
        setCreatorSearch('');
    }

    const activeFilters = [];

    if(dateSort !== ''){
        activeFilters.push({
            label: dateSort,
            onDelete: () => setDateSort('')
        })
    }

    if(creatorId !== ''){
        const creatorUser = users.find(u => u._id === creatorId)
        activeFilters.push({
            label: creatorUser?.name + ' ' + creatorUser?.lastName,
            onDelete: () => setCreatorId('')
        })
    }

    if(categoriesFilter.length > 0){
        categoriesFilter.forEach(category => {
            activeFilters.push({
                label: category,
                onDelete: () => handleCategoryToggle(category)
            })
        })
    }

    if(favorites !== ''){
        activeFilters.push({
            label: 'Favorite Posts',
            onDelete: () => setFavorites('') 
        })
    }

    

    const filteredCards = useMemo(() => {

        // Step 1: Choose starting data based on favorites filter:
        let result = 
        favorites === 'myFavorites' ? [...favoriteCards] : [...registeredCards];
        
        if(creatorId !== ''){
            result = result.filter(card => card.userId === creatorId)
        }

        if(debounceSearchCard !== ''){
            result = result.filter(card => {
                const findCreator = users.find(u => card.userId === u._id)
                return (findCreator?.name + ' ' + findCreator?.lastName).toLowerCase().includes(debounceSearchCard.toLowerCase()) 
                ||
                (card.title || '').toLowerCase().includes(debounceSearchCard.toLowerCase()) 
                ||
                (card.category || '').toLowerCase().includes(debounceSearchCard.toLowerCase()) 
                ||
                (card.content || '').toLowerCase().includes(debounceSearchCard.toLowerCase()) 
            })
        }

        if(dateSort !== ''){
            if(dateSort === 'newest'){
                result.sort((a,b) => b.createdAt.localeCompare(a.createdAt))
            }
            else if (dateSort === 'oldest'){
                result.sort((a,b) => a.createdAt.localeCompare(b.createdAt))   
            } 
            else if(dateSort === 'most liked'){
                result.sort((a,b) => b.likes.length - a.likes.length)
            }
            else if(dateSort === 'most commented'){
                result.sort((a,b) => b.comments.length - a.comments.length)
            }
        }

        if(categoriesFilter.length > 0){
            result = result.filter(card => categoriesFilter.includes(card.category))
        }



        return result;
    }, [creatorId, registeredCards, debounceSearchCard, dateSort, categoriesFilter, favorites, favoriteCards, users])
    
    const countedRegisterCards = filteredCards.slice(0, count)    

  return (
    <Container maxWidth="lg" sx={{py:3, pb: {xs: 20, md: 3}}}>
        <Grid container spacing={3}>
            {/* Sidebar */}
            <Grid 
                size={{xs: 12, md:4}} 
                sx={{
                    position: {xs: 'fixed', md: 'sticky'},
                    top: {xs: 0, md: 10},
                    left: {xs: 0, md: 'auto'},
                    width: '100%',
                    height: {xs: '100dvh', md: 'calc(100vh - 94px)'},
                    overflow: 'auto',
                    overscrollBehavior: 'contain',
                    bgcolor: {xs: 'background.default', md: 'transparent'},
                    zIndex: {xs: 1000, md: 'auto'},
                    p: {xs: 2, md:0},
                    display: {xs: isFiltersOpen ? 'flex' : 'none', md: 'flex'}, 
                    flexDirection: 'column',
                    gap: 2,
                    pb: {xs: 4, md: 0},
                    // hide scrollbar visually but keep it functional
                    '&::-webkit-scrollbar': {display: 'none'}
                }}>

                {/* Sort */}
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 3,
                        border: '0.5px solid',
                        borderColor: 'divider',
                        p: 2,
                    }}
                >
                    <Typography fontWeight={600} fontSize={13} mb={1.5}>
                        Sort By
                    </Typography>


                    {SORT_OPTIONS.map((sort) => (
                        <Box
                            key={sort.value}
                            onClick={() => setDateSort(sort.value)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                cursor: 'pointer',
                                borderRadius: 2,
                                px: 1,
                                py: 0.5,
                                my: 1,
                                bgcolor: dateSort === sort.value ? 'action.selected' : 'transparent',
                                '&:hover': {bgcolor: 'action.hover'}
                            }}
                        >

                            {dateSort === sort.value && <CheckBoxIcon sx={{fontSize: 19}}/>}

                            <Typography fontSize={13} color='text.secondary'>
                                {sort.label}
                            </Typography>
                        </Box>
                        
                    ))}
                </Paper>

                {/* Category */}
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 3,
                        border: '0.5px solid',
                        borderColor: 'divider',
                        p: 2,
                    }}
                >
                    <Typography fontWeight={600} fontSize={13} mb={1.5}>
                        Category
                    </Typography>


                    {CARD_CATEGORIES.slice(0, showAllCategories ? CARD_CATEGORIES.length : 7).map((category, index) => {

                        const countedPostsByCat = registeredCards.filter(card => card.category === category).length

                        return(
                            <Box 
                                key={category} 
                                onClick ={() => handleCategoryToggle(category)}
                                sx={{
                                    display: 'flex', 
                                    alignItems: 'center',
                                    borderRadius: 2,
                                    bgcolor: categoriesFilter.includes(category) ? 'action.selected' : 'transparent',
                                    cursor: 'pointer',
                                    pr: 1,
                                    my: 1,
                                    opacity: countedPostsByCat === 0 ? 0.4 : 1,
                                    pointerEvents: countedPostsByCat === 0 ? 'none' : 'auto'
                                }}
                            
                            >
                                <Checkbox
                                    size='small'
                                    checked={categoriesFilter.includes(category)}
                                    disabled={countedPostsByCat < 1}
                                    />
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flex: 1,
                                    }}
                                >
                                    <Typography
                                        fontSize={14} 
                                        color='text.secondary'
                                    >
                                        {category}
                                    </Typography>

                                    <Typography fontWeight={700} fontSize={13} color='text.disabled'>
                                        {countedPostsByCat}
                                    </Typography>
                                </Box>
                        </Box>
                        )
                    })}
                    <Button 
                        sx={{
                            border: '1px solid',
                            borderColor: 'primary',
                            borderRadius: 5,
                            fontSize: 11,
                            px: 2
                        }}
                        size='small'
                        onClick={() => setShowAllCategories(!showAllCategories)}
                        endIcon={!showAllCategories ? <KeyboardArrowDownIcon/> : <KeyboardArrowUpIcon/>}
                    >
                        {showAllCategories ? 'Show less' : 'Show More..'}
                    </Button>
                </Paper>

                {/* Creator */}
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 3,
                        border: '0.5px solid',
                        borderColor: 'divider',
                        p: 2,
                    }}
                >
                    <Typography fontWeight={600} fontSize={13} mb={1.5}>
                        Creator
                    </Typography>

                    <TextField
                        fullWidth
                        size='small'
                        placeholder='Search Post..'
                        value={creatorSearch}
                        onChange={(e) => setCreatorSearch(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                )
                            }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root':{
                                borderRadius: 5,
                                fontSize: 13,
                                mb:1
                            }
                        }}
                    />

                    <Typography
                        sx={{
                            fontSize: 12,
                            color: 'text.secondary'
                        }}
                    >
                        {filterCreators.length} Results
                    </Typography>

                    <Box
                        sx={{
                            // top: 20,
                            maxHeight: 300,
                            overflow: 'auto',
                        }}
                    >

                        {filterCreators.map((userF) => (
                            <Box 
                                key={userF._id}
                                onClick={() => setCreatorId(userF._id === creatorId ? '' : userF._id)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    cursor: 'pointer',
                                    borderRadius: 2,
                                    px: 1,
                                    py: 0.5,
                                    my: 0.5,
                                    bgcolor: creatorId === userF._id ? 'action.selected' : 'transparent',
                                    '&:hover': {bgcolor: 'action.hover'}
                                }}
                                >
                                <Avatar 
                                    src={userF.profilePicture}
                                    sx={{width: 34, height: 34}}
                                    />
                                <Box
                                    sx={{display: 'flex', flexDirection: 'column', }}
                                >
                                        <Typography
                                            fontSize={14}
                                        >
                                            {userF.name} {userF.lastName}
                                        </Typography>
                                    <Typography component={'div'} fontSize={11} color='text.secondary' lineHeight={0.9}>
                                        {userF?.job}
                                    </Typography>

                                </Box>

                            </Box>
                        ))}
                    </Box>
                </Paper>

                {/* Saved Posts/ all Posts */}
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 3,
                        border: '0.5px solid',
                        borderColor: 'divider',
                        p: 2,
                    }}
                >
                    <Typography fontWeight={600} fontSize={13} mb={1.5}>
                        Show
                    </Typography>

                    <Box
                        onClick={() => setFavorites('')}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                            borderRadius: 2,
                            px: 1,
                            py: 0.5,
                            my: 1,
                            bgcolor: favorites === '' ? 'action.selected' : 'transparent',
                            '&:hover': {bgcolor: 'action.hover'}
                        }}
                    >

                        {favorites === '' && <CheckBoxIcon sx={{fontSize: 19}}/>}

                        <Typography fontSize={13} color='text.secondary'>
                            All posts
                        </Typography>
                    </Box>

                    <Box
                        onClick={() => setFavorites('myFavorites')}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                            borderRadius: 2,
                            px: 1,
                            py: 0.5,
                            my: 1,
                            bgcolor: favorites === 'myFavorites' ? 'action.selected' : 'transparent',
                            '&:hover': {bgcolor: 'action.hover'}
                        }}
                    >

                        {favorites === 'myFavorites' && <CheckBoxIcon sx={{fontSize: 19}}/>}

                        <Typography fontSize={13} color='text.secondary'>
                            Favorite posts
                        </Typography>
                    </Box>
                </Paper>

                <Box sx={{display: {xs: 'flex', md: 'none'}, gap: 1}}>
                    <Button
                        variant='contained'
                        fullWidth
                        onClick={() => setIsFiltersOpen(false)}
                        disabled={activeFilters.length === 0}
                        sx={{
                            display: {xs: 'flex', md: 'none'},
                            borderRadius: 5,
                        }}
                        startIcon={<FilterListIcon/>}
                    >
                        Apply Filters
                    </Button>

                    <IconButton
                        sx={{
                            display: {xs: 'flex', md: 'none'},
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 5,
                        }} 
                        variant='contained'
                        size='small'
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}    
                    >
                        <CloseIcon color='divider'/>
                    </IconButton>
                </Box>

            </Grid>


            <Grid size={{md:8}}>
                {/* main */}
                <Box sx={{display: 'flex', gap:1}}>

                    <TextField
                        fullWidth
                        size='small'
                        placeholder='Search Post..'
                        value={searchCard}
                        onChange={(e) => setSearchCard(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                )
                            }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root':{
                                borderRadius: 5,
                                fontSize: 13
                            }
                        }}
                    />
                    <IconButton
                        sx={{
                            display: {xs: 'flex', md: 'none'},
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 5,
                            mb:1
                        }} 
                        variant='contained'
                        size='small'
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}    
                    >
                        <FilterListIcon color='divider'/>
                    </IconButton>
                </Box>

                <Typography 
                    color='text.secondary'
                    fontSize={15}
                    mx={{xs: 1, md: 1}}
                    mt={{xs: 0, md: 1}}
                >
                    {filteredCards.length} Results
                </Typography>

                <Box 
                    sx={{
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        py:1,
                    }}>

                    <Box sx={{
                        display: 'flex', 
                        justifyContent: 'start',
                        alignItems: {xs: 'flex-start', md: 'center'},
                        gap: 1, 
                        flexWrap: 'wrap'
                    }}>

                        {activeFilters.map((filter, index) => (
                            <Chip
                                key={index}
                                label={filter.label}
                                size='small'
                                onDelete={filter.onDelete}
                            />
                        ))}


                    </Box>
                </Box>

                {activeFilters.length > 0 && (
                    <Button
                        size='small'
                        onClick={handleClearAllFilters}
                        sx={{borderRadius: 5, fontSize: 11, mx: 0}}
                        variant='outlined'
                    >
                        Clear All Filters
                    </Button>
                )}

                {countedRegisterCards.map((card) => (
                    <CardItem
                        key={card._id}
                        card={card}
                        onOpenCard={() => setSelectedCardId(card._id)}
                        openCommentCardId={openCommentCardId}
                        setOpenCommentCardId = {setOpenCommentCardId}
                        onRemoveSavedCard = {() => handleRemoveCard(card)}
                        onSaveCard = {() => handleFavoriteCards(card)}
                        isSavedCard = {favoriteCards.some(c => c._id === card._id)}
                    />
                ))}

                {selectedCardId && (
                    <CardPopupModal
                        cardId = {selectedCardId}
                        onClose = {() => setSelectedCardId(null)}
                    />
                )}

                {filteredCards.length > count &&(
                    <Box
                        sx={{
                            display: 'flex',
                            width: '100%', 
                            justifyContent: 'center'}}
                    >
                        <Button 
                            onClick={() => setCount(count + 10)}
                            endIcon={<ExpandCircleDownIcon/>} 
                            variant='outlined'
                            sx={{borderRadius: 5}}
                            >
                                Load More
                        </Button>
                    </Box>
                )}

            </Grid>
        </Grid>
    </Container>
  )
}