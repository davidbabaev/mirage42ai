import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useDebounce from '../hooks/useDebounce';
import useSelectedUsers from '../hooks/useSelectedUsers';
import { Box, Button, Checkbox, Chip, Container, Grid, IconButton, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import UsersPageSorts from '../components/UsersPageSorts';
import SearchIcon from '@mui/icons-material/Search';
import UserReusableCard from '../components/UserReusableCard';
import { useCardsProvider } from '../providers/CardsProvider';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../providers/AuthProvider';
import { useCursorPagination } from '../hooks/useCursorPagination';
import InfiniteScroll from '../components/InfiniteScroll';
import { getUsersSearch, getUserCountries } from '../services/apiService';


function UsersPage() {

    const {user} = useAuth();
    const {selectedUsers, selectHandleUser, handleRemoveUser} = useSelectedUsers();
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 400);
    const {registeredCards} = useCardsProvider();

    // sorts
    const [ageSort, setAgeSort] = useState('');
    const [nameSort, setNameSort] = useState('');

    // filters
    const [genderFilter, setGenderFilter] = useState('');
    const [countriesFilter, setCountriesFilter] = useState([]);

    // Mobile:
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    // Country options loaded once from server (replaces deriving from loaded users)
    const [availableCountries, setAvailableCountries] = useState([]);

    useEffect(() => {
        getUserCountries()
            .then(data => setAvailableCountries(data?.countries ?? []))
            .catch(() => {});
    }, []);


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

    const handleCountryToggle = (country) => {
        setCountriesFilter((prev) => {
            const include = prev.includes(country)
            if(!include){
                return [...prev, country]
            }
            return prev.filter(c => c !== country)
        })
    }

    // Collapse ageSort + nameSort into a single `sort` value for the server query.
    // Age selection wins if set; otherwise fall through to name sort.
    // The UI already enforces mutual exclusivity (selecting one clears the other),
    // so `ageSort || nameSort` reliably produces the correct single value.
    const searchParams = useMemo(() => ({
        search: debouncedSearch,
        gender: genderFilter,
        sort: ageSort || nameSort,
        countries: countriesFilter,
    }), [debouncedSearch, genderFilter, ageSort, nameSort, countriesFilter]);

    const fetcher = useCallback(
        (cursor) =>
            getUsersSearch(searchParams, cursor, 15).then(r => ({
                items: r.items ?? [],
                nextCursor: r.nextCursor ?? null,
            })),
        [searchParams]
    );

    const { items, hasMore, loading, loadingMore, error, refresh, loadMore } = useCursorPagination(fetcher);

    // When searchParams change, fetcher identity changes → refresh() changes identity →
    // this effect fires and resets pagination to page 1 with the new params.
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Exclude the logged-in user client-side (server may include self).
    const displayUsers = useMemo(
        () => items.filter(u => u._id !== user?._id),
        [items, user?._id]
    );

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
        countriesFilter.forEach(country => {
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
                        {availableCountries.slice(0, 10).map((countryC) => (
                            <Box
                                key={countryC}
                                onClick={() => handleCountryToggle(countryC)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: 2,
                                    bgcolor: countriesFilter.includes(countryC) ? 'action.selected' : 'transparent',
                                    cursor: 'pointer',
                                    pr: 1,
                                    my: 1,
                                }}
                            >
                                <Checkbox
                                    size='small'
                                    checked={countriesFilter.includes(countryC)}
                                />
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        flex: 1,
                                    }}
                                >
                                    <Typography
                                        fontSize={14}
                                        color='text.secondary'
                                    >
                                        {countryC}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
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
                        {displayUsers.length} Results
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
                    <InfiniteScroll
                        loading={loading}
                        loadingMore={loadingMore}
                        hasMore={hasMore}
                        error={!!error}
                        isEmpty={!loading && items.length === 0}
                        onLoadMore={loadMore}
                        onRetry={refresh}
                        emptyState={
                            <Box sx={{ textAlign: 'center', py: 6 }}>
                                <Typography color='text.secondary'>No users found</Typography>
                            </Box>
                        }
                    >
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {xs: 'repeat(1, 1fr)', md:'repeat(2, 1fr)'},
                                py: 3,
                                gap: 2,
                            }}
                        >
                            {displayUsers.map((u) => {
                                const myCardsCount = u?.postsCount ?? registeredCards.filter(card => card.userId === u?._id).length;
                                return(
                                    <UserReusableCard
                                        key={u._id}
                                        userObject={u}
                                        postsCount={myCardsCount}
                                        onRemoveSaved={() => handleRemoveUser(u)}
                                        onSave={() => selectHandleUser(u)}
                                        isSaved={selectedUsers.some(s => s._id === u._id)}
                                    />
                                )
                            })}
                        </Box>
                    </InfiniteScroll>
                </Grid>

            </Grid>
        </Container>
    )
}

export default React.memo(UsersPage)
