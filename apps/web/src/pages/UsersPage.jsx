import React, { useMemo, useState } from 'react'
import useDebounce from '../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import useSelectedUsers from '../hooks/useSelectedUsers';
import { Box, Button, Checkbox, Chip, Container, Grid, IconButton, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import UsersPageSorts from '../components/UsersPageSorts';
import SearchIcon from '@mui/icons-material/Search';
import UserReusableCard from '../components/UserReusableCard';
import { useCardsProvider } from '../providers/CardsProvider';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import OnLoadingSkeletonBox from '../components/OnLoadingSkeletonBox';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useUsersProvider } from '../providers/UsersProvider';


function UsersPage() {

    const {users, loading} = useUsersProvider();
    const {selectedUsers ,selectHandleUser, handleRemoveUser} = useSelectedUsers();
    const [count, setCount] = useState(10);
    const [search, setSearch] = useState('')
    const debounceSearch = useDebounce(search, 2000);
    const {registeredCards} = useCardsProvider();
    
    // sorts
    const [ageSort, setAgeSort] = useState('');
    const [nameSort, setNameSort] = useState('');

    // filters
    const [genderFilter, setGenderFilter] = useState('');
    const [countriesFilter, setCountriesFilter] = useState([]);

    // Mobile:
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    
    const navigateToUser = useNavigate();

    const SORT_AGE = [
        {label: 'All', value: ''},
        {label: 'Youngest', value: 'youngest'},
        {label: 'Oldest', value: 'oldest'}
    ]
    
    const SORT_NAME_AZ = [
        {label: 'All', value: ''},
        {label: 'A → Z', value: 'az'},
        {label: 'Z → A', value: 'za'}
    ]
    
    const SORT_GENDER = [
        {label: 'All', value: ''},
        {label: 'Male', value: 'Male'},
        {label: 'Female', value: 'Female'}
    ]

    const countries = [...new Set(users.map(user => user.address?.country.toLowerCase()))]
    // remove doplicates from array, and we get new array by name countries that without duplicates

    const handleCountryToggle = (country) => {
        setCountriesFilter((prev) => {
            const include = prev.includes(country)
            if(!include){
                return [...prev, country]
            }
            return prev.filter(c => c !== country)
        })
    }

    const activeFilters = [];

    if(ageSort !== ''){
        activeFilters.push({
            label: ageSort,
            onDelete: () => setAgeSort('') 
        })
    }

    if(nameSort !== ''){
        activeFilters.push({
            label: nameSort,
            onDelete: () => setNameSort('') 
        })
    }

    if(genderFilter !== ''){
        activeFilters.push({
            label: genderFilter,
            onDelete: () => setGenderFilter('') 
        })
    }

    if(countriesFilter.length > 0){
        countriesFilter.forEach(country  => {
            activeFilters.push({
                label: country,
                onDelete: () => handleCountryToggle(country) 
            })
        })
    }

    const handleClearAllFilters = () => {
        setAgeSort(''),
        setGenderFilter(''),
        setCountriesFilter([]),
        setNameSort(''),
        setSearch('')
    }

    const maleCount = users.filter(u => u.gender === 'Male').length
    
    const filtred = useMemo(() => {
        let result = users;

        // country filter:
        if(countriesFilter.length > 0){
            result = result.filter(user => countriesFilter.includes(user?.address?.country.toLowerCase()))
        }

        // search by name;
        result = result.filter((user) => {
            return user?.name?.toLowerCase().includes(debounceSearch.toLowerCase())
        });

        // filter: Gender
        if(genderFilter !== ''){
            result = result.filter(user => user.gender === genderFilter)
        }

        // sorts:
        result.sort((a,b) => {
            let comparison = 0;

            // age sort:
            if(ageSort === 'youngest'){
                comparison = a.age - b.age;
            } else if(ageSort === 'oldest'){
                comparison = b.age - a.age;
            }

            // name sort:
            if(comparison === 0){
                if(nameSort === 'az'){
                    comparison = a.name.localeCompare(b.name);
                } else if(nameSort === 'za'){
                    comparison = b.name.localeCompare(a.name);
                }
            }

            return comparison;
        });

        return result;
    }, [debounceSearch, users, ageSort, nameSort, genderFilter, countriesFilter])


    const filteredWithoutCountry = useMemo(() => {    
        let result = users;

        // search by name;
        result = result.filter((user) => {
            return user?.name?.toLowerCase().includes(debounceSearch.toLowerCase())
        });

        // filter: Gender
        if(genderFilter !== ''){
            result = result.filter(user => user.gender === genderFilter)
        }

        return result

    }, [users, debounceSearch, genderFilter])
    
    const visibleUsers = filtred.slice(0, count)
    
    if(loading) return <OnLoadingSkeletonBox/>
    

    return(
        <Container maxWidth='lg' sx={{py:3, pb: 3}}>
            <Grid container spacing={3}>

                {/* Side Bar */}
                <Grid 
                    size={{xs: 12, md: 4}}
                    sx={{
                        position: {xs: 'fixed', md: 'sticky'},
                        top: {xs: 0, md: 10},
                        left: {xs: 0, md: 'auto'},
                        width: '100%',
                        height: {xs: '100dvh', md: 'calc(100vh - 64px)'},
                        overflow: 'auto',
                        overscrollBehavior: 'contain',
                        bgcolor: {xs: 'background.default', md: 'transparent'},
                        zIndex: {xs: 1000, md:'auto'},
                        p: {xs: 2, md:0},
                        display: {xs: isFiltersOpen ? 'flex' : 'none', md: 'flex'}, 
                        // justifyContent: 'center', 
                        flexDirection: 'column',
                        gap: 2,
                        pb: {xs: 4, md: 0},
                        
                        // hide scrollbar visually but keep it functional
                        '&::-webkit-scrollbar': {display: 'none'}
                    }}
                >   
                    {/* Sort Age*/}
                    <UsersPageSorts
                        style={{
                            opacity: nameSort ? 0.4 : 1,
                            pointerEvents: nameSort ? 'none' : 'auto'
                        }}
                        title = 'Sort by age'
                        options = {SORT_AGE}
                        selectedValue = {ageSort}
                        onSelect = {(value) => {
                            setAgeSort(value), 
                            setNameSort('')
                        }}
                    />
                    
                    {/* Sort */}
                    <UsersPageSorts
                        style={{
                            opacity: ageSort ? 0.4 : 1,
                            pointerEvents: ageSort ? 'none' : 'auto'
                        }}
                        title = 'Sort by A-Z'
                        options = {SORT_NAME_AZ}
                        selectedValue = {nameSort}
                        onSelect = {(value) => {
                            setNameSort(value),
                            setAgeSort('')
                        }}
                    />
                    
                    {/* Sort */}
                    <UsersPageSorts
                        title = 'Sort by Gender'
                        options = {SORT_GENDER}
                        selectedValue = {genderFilter}
                        onSelect = {setGenderFilter}
                    />

                    <Paper
                        elevation={0}
                        sx={{
                            borderRadius: 3,
                            border: '0.5px solid',
                            borderColor: 'divider',
                            p: 2,
                        }}
                    >
                        {countries.slice(0, 10).map((countryC, index) => {

                            const countedUsersByCountry = filteredWithoutCountry.filter(u => u.address.country.toLowerCase() === countryC).length

                            return(
                                <Box 
                                    key={countryC} 
                                    onClick ={() => handleCountryToggle(countryC)}
                                    sx={{
                                        display: 'flex', 
                                        alignItems: 'center',
                                        borderRadius: 2,
                                        bgcolor: countriesFilter.includes(countryC) ? 'action.selected' : 'transparent',
                                        cursor: 'pointer',
                                        pr: 1,
                                        my: 1,
                                        opacity: countedUsersByCountry === 0 ? 0.4 : 1,
                                        pointerEvents: countedUsersByCountry === 0 ? 'none' : 'auto'
                                    }}
                                
                                >
                                    <Checkbox
                                        size='small'
                                        checked={countriesFilter.includes(countryC)}
                                        disabled={countedUsersByCountry < 1}
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
                                            {countryC}
                                        </Typography>
    
                                        <Typography fontWeight={700} fontSize={13} color='text.disabled'>
                                            {countedUsersByCountry}
                                        </Typography>
                                    </Box>
                            </Box>
                            )
                        })}
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
                
                

                <Grid size={{xs: 12, md:8}}>

                    <Box sx={{display: 'flex', gap:1}}>
                        <TextField
                            fullWidth
                            size='small'
                            placeholder='Search People..'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
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
                        {filtred.length} Results
                    </Typography>

                    <Box
                        sx={{
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            p:1, 
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex', 
                                gap: 1, 
                                alignItems: 'center', 
                                flexWrap: 'wrap'
                            }}
                        >
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
                            sx={{borderRadius: 5, fontSize: 11, mx:1}}
                            variant='outlined'
                        >
                            Clear All Filters
                        </Button>
                    )}

                    
                    {/* Users List */}
                    <Box
                        sx={{
                            display: 'grid', 
                            // flexWrap: 'wrap',
                            gridTemplateColumns: {xs: 'repeat(1, 1fr)', md:'repeat(2, 1fr)'},
                            py: 3, 
                            gap: 2,
                            // width: '100%',
                            // justifyContent: 'space-between'
                        }}  
                    >
                        {visibleUsers.map((user) => {
                            const myCardsCount = registeredCards.filter(card => card.userId === user?._id).length;
                            return(
                                <UserReusableCard
                                    key={user._id}
                                    userObject={user}
                                    postsCount={myCardsCount}
                                    onRemoveSaved={() => handleRemoveUser(user)}
                                    onSave = {() => selectHandleUser(user)}
                                    isSaved={selectedUsers.some(s => s._id === user._id)}
                                />
                            )
                        })}
                    </Box>


                    {filtred.length > count &&(
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

export default React.memo(UsersPage)
