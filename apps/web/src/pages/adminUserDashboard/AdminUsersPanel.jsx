import React, { useState, useMemo } from 'react'
import { useCardsProvider } from '../../providers/CardsProvider';
import useDebounce from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import useCountries from '../../hooks/useCountries';
import { Box, InputAdornment, MenuItem, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Avatar, Button, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';

export default function AdminUsersPanel() {

  const {users, handleDeleteUser, loading, handleBanUser, handlePromoteUser, getUsers} = useUsersProvider();
  const {registeredCards, refreshFeed, fetchCards} = useCardsProvider();
  const {apiCountriesList} = useCountries(); 
  const [search, setSearch] = useState('');
  const debounceSearch = useDebounce(search, 2000);
  const {user} = useAuth();

  // const pageSize = 10;
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [confirmUser, setConfirmUser] = useState(null);
 
  // sort table
  const [sortConfig, setSortConfig] = useState({column: '', direction: 'asc'});
  
  const handleSortTable = (column) => {
    if(column !== sortConfig.column){
      setSortConfig({column: column, direction: 'asc'})
    }
    else{
      setSortConfig({column:column ,direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})
    }
  }

  // sorts
  const [ageSort, setAgeSort] = useState('');
  const [nameSort, setNameSort] = useState('');

  // filters
  const [genderFilter, setGenderFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  const navigate = useNavigate();

  const countries = [...new Set(users.map(user => user.address?.country.toLowerCase()))]

  const filtred = useMemo(() => {
  
    let result = users;

    // search by name;
    result = result.filter((user) => {
        return user?.name?.toLowerCase().includes(debounceSearch.toLowerCase())
    });

    // filter: Gender
    if(genderFilter !== ''){
        result = result.filter(user => user.gender === genderFilter)
    }

    // country filter:
    if(countryFilter !== ''){
        result = result.filter(user => user?.address?.country.toLowerCase() === countryFilter.toLowerCase())
    }

    // Role filter:
    if(roleFilter === 'admin'){
        result = result.filter(user => user.isAdmin === true)
    }

    if(roleFilter === 'user'){
        result = result.filter(user => user.isAdmin === false)
    }

    // sorts:
    result = [...result].sort((a,b) => {
        let comparison = 0;

        // age sort:
        if(ageSort === 'low'){
            comparison = a.age - b.age;
        } else if(ageSort === 'high'){
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

        // sort table
        if(sortConfig.column !== ''){
            if(sortConfig.column === 'followers'){
              const aFollowers = users.filter(u => u.following.includes(a._id)).length;
              const bFollowers = users.filter(u => u.following.includes(b._id)).length;
              
              if(sortConfig.direction === 'asc'){
                return aFollowers - bFollowers
              }
              else{
                return bFollowers - aFollowers
              }
            }
            
            if(sortConfig.column === 'joined'){
              if(sortConfig.direction === 'asc'){
                return new Date(a.createdAt) - new Date(b.createdAt)
              }
              else{
                return new Date(b.createdAt) - new Date(a.createdAt)
              }
            }
            
            if(sortConfig.column === 'posts'){
              const aPosts = registeredCards.filter(c => c.userId === a._id).length;
              const bPosts = registeredCards.filter(c => c.userId === b._id).length;
              
              if(sortConfig.direction === 'asc'){
                return aPosts - bPosts
              }
              else{
                return bPosts - aPosts
              }
            }
        }

        return comparison;
    });
    return result;
  }, [debounceSearch, users, ageSort, nameSort, genderFilter, countryFilter, roleFilter,sortConfig])
  
  
  const totalPages = Math.ceil(filtred.length / pageSize);

  const numbersArray = (num) => {
    return Array.from({length: num}, (_, i) => i + 1);
  }
  const pagesNumbers = numbersArray(totalPages)

  const sliced = filtred.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const startPage = (currentPage - 1) * pageSize + 1;
  const endPage = Math.min(currentPage * pageSize, filtred.length);
  const total = filtred.length 

  const headCellSx = {fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap'}
  const sortableSx = {...headCellSx, cursor: 'pointer', userSelect: 'none'}

  
  if(loading) return <OnLoadingSkeletonBox/>
  
  
  return(
    <Box sx={{my: 2, m: {xs: 1,md:2}}}>
        {/* Page Header */}
        <Box mb={3}>
            <Typography fontSize={25} fontWeight={700}>Users Management</Typography>
            <Typography fontSize={14} color='text.secondary'>
                {filtred.length} users found
            </Typography>
        </Box>

        {/* Filters */}
        <Box sx={{
            display: 'flex',
            flexDirection: {xs: 'column', md: 'row'},
            gap: {xs:1, md:2},
            flexWrap: 'wrap',
            alignItems: 'center',
            mb: 3,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            bgcolor: 'background.paper'
        }}>
            <TextField
                size='small'
                placeholder='Search by name...'
                value={search}
                onChange={(e) => {
                    setSearch(e.target.value)
                    setCurrentPage(1)
                }}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon/>
                            </InputAdornment>
                        )
                    }
                }}
                sx={{
                    minWidth: {xs: '100%',md: 200},
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 5,
                        fontSize: 13
                    }
                }}
            />

            <TextField
                select
                size='small'
                value={ageSort}
                onChange={(e) => {
                    setAgeSort(e.target.value)
                    setCurrentPage(1)
                }}
                disabled={!!nameSort}
                slotProps={{
                  select: {
                    displayEmpty: true,
                    renderValue: (value) => value === '' ? 'All Ages' : value === 'low' ? 'Low → High' : 'High → Low'
                  }
                }}
                sx={{minWidth: {xs: '100%',md: 130}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
            >
                <MenuItem value="">All Ages</MenuItem>
                <MenuItem value="low">Low → High</MenuItem>
                <MenuItem value="high">High → Low</MenuItem>
            </TextField>

            <TextField
                select
                size='small'
                value={nameSort}
                onChange={(e) => {
                    setNameSort(e.target.value)
                    setCurrentPage(1)
                }}
                disabled={!!ageSort}
                slotProps={{
                  select: {
                    displayEmpty: true,
                    renderValue: (value) => value === '' ? 'A/Z Mixed' : value === 'az' ? 'A → Z' : 'Z → A'
                  }
                }}
                sx={{minWidth: {xs: '100%',md:130}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
            >
                <MenuItem value="">A/Z Mixed</MenuItem>
                <MenuItem value="az">A → Z</MenuItem>
                <MenuItem value="za">Z → A</MenuItem>
            </TextField>

            <TextField
                select
                size='small'
                value={genderFilter}
                onChange={(e) => {
                    setGenderFilter(e.target.value)
                    setCurrentPage(1)
                }}
                slotProps={{
                  select: {
                    displayEmpty: true,
                    renderValue: (value) => value === '' ? 'All Genders' : value === 'Male' ? 'Male' : 'Female'
                  }
                }}
                sx={{minWidth: {xs: '100%',md: 130}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
            >
                <MenuItem value="">All Genders</MenuItem>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
            </TextField>

            <TextField
                select
                size='small'
                value={roleFilter}
                onChange={(e) => {
                    setRoleFilter(e.target.value)
                    setCurrentPage(1)
                }}
                slotProps={{
                  select: {
                    displayEmpty: true,
                    renderValue: (value) => value === '' ? 'All Roles' : value === 'admin' ? 'admin' : 'user'
                  }
                }}
                sx={{minWidth: {xs: '100%',md: 130}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
            >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="user">User</MenuItem>
            </TextField>

            <TextField
                select
                size='small'
                value={countryFilter}
                onChange={(e) => {
                    setCountryFilter(e.target.value)
                    setCurrentPage(1)
                }}
                slotProps={{
                  select: {
                    displayEmpty: true,
                    renderValue: (value) => value || 'All Countries'
                  }
                }}
                sx={{minWidth: {xs: '100%',md: 150}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
            >
                <MenuItem value="">All Countries</MenuItem>
                {countries.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
            </TextField>
        </Box>
      
      {/* Table */}
      <Box sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'background.paper'
      }}>
          <Box sx={{overflowX: 'auto'}}>
              <Table 
                size='small' 
                sx={{
                  minWidth: 1400,
                  '& .MuiTableCell-root': {
                  border: 'none',
                  py: 2,
                  fontSize: 13
                  },
                  '& .MuiTableBody-root .MuiTableRow-root': {
                      borderBottom: '1px solid',
                      borderColor: 'divider'
                  },
                  '& .MuiTableBody-root .MuiTableRow-root:last-child': {
                      borderBottom: 'none'
                  }
                }}
                
              >
                  <TableHead sx={{
                      '& .MuiTableCell-root': {
                        color: 'text.secondary',
                        fontWeight: 600,
                        fontSize: 12,
                        border: 'none',
                        pb: 1.5
                      }
                    }}>
                      <TableRow>
                          <TableCell sx={headCellSx}>#</TableCell>
                          <TableCell sx={headCellSx}>Profile</TableCell>
                          <TableCell sx={headCellSx}>Name</TableCell>
                          <TableCell sx={headCellSx}>Email</TableCell>
                          <TableCell sx={headCellSx}>Last Login</TableCell>
                          <TableCell sx={headCellSx}>Country</TableCell>
                          <TableCell 
                              sx={sortableSx}
                              onClick={() => handleSortTable('joined')}
                          >
                              Joined {sortConfig.column === 'joined' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </TableCell>
                          <TableCell 
                              sx={sortableSx}
                              onClick={() => handleSortTable('posts')}
                          >
                              Posts {sortConfig.column === 'posts' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </TableCell>
                          <TableCell 
                              sx={sortableSx}
                              onClick={() => handleSortTable('followers')}
                          >
                              Followers {sortConfig.column === 'followers' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </TableCell>
                          <TableCell sx={headCellSx}>Role</TableCell>
                          <TableCell sx={headCellSx}>Status</TableCell>
                          <TableCell sx={headCellSx}>Delete</TableCell>
                          <TableCell sx={headCellSx}>Ban</TableCell>
                          <TableCell sx={headCellSx}>Promote</TableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                      {sliced.map((userM, indexM) => {
                          const userCardsCount = registeredCards.filter((card) => card.userId === userM._id).length;
                          const userFollowersCount = users.filter((userF) => userF.following.includes(userM._id)).length;
                          const userFlag = apiCountriesList.find(f => f.name === userM.address?.country);

                          return (
                              <TableRow 
                                  key={userM._id}
                                  hover
                                  onClick={() => navigate(`/profiledashboard/${userM._id}/profilemain`)}
                                  sx={{cursor: 'pointer'}}
                              >
                                  <TableCell sx={{fontSize: 13}}>{indexM + (currentPage - 1) * pageSize + 1}</TableCell>
                                  <TableCell>
                                      <Avatar src={userM.profilePicture} sx={{width: 36, height: 36}}/>
                                  </TableCell>
                                  <TableCell sx={{fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap'}}>{userM.name} {userM.lastName}</TableCell>
                                  <TableCell sx={{color: 'text.secondary', fontSize: 12}}>{userM.email}</TableCell>
                                  <TableCell sx={{color: 'text.secondary', fontSize: 12}}>{userM.lastLoginAt.split("T")[0]}</TableCell>
                                  <TableCell>
                                      <Box
                                          component='img'
                                          src={userFlag?.flag || "https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png"}
                                          onError={(e) => e.target.src = "https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png"}
                                          sx={{width: 30, height: 20, borderRadius: 0.5, objectFit: 'cover'}}
                                      />
                                  </TableCell>
                                  <TableCell sx={{fontSize: 12}}>{userM.createdAt.split("T")[0]}</TableCell>
                                  <TableCell sx={{fontSize: 13, fontWeight: 600}}>{userCardsCount}</TableCell>
                                  <TableCell sx={{fontSize: 13, fontWeight: 600}}>{userFollowersCount}</TableCell>
                                  <TableCell>
                                      <Chip 
                                          label={userM.isAdmin ? "Admin" : "User"} 
                                          size='small'
                                          sx={{
                                              bgcolor: userM.isAdmin ? 'primary.main' : 'action.selected',
                                              color: userM.isAdmin ? 'white' : 'text.secondary',
                                              fontWeight: 600,
                                              fontSize: 11
                                          }}
                                      />
                                  </TableCell>
                                  <TableCell>
                                      <Chip 
                                          label={userM.isBanned ? "Banned" : "Active"} 
                                          size='small'
                                          sx={{
                                              bgcolor: userM.isBanned ? 'error.main' : 'success.main',
                                              color: 'white',
                                              fontWeight: 600,
                                              fontSize: 11
                                          }}
                                      />
                                  </TableCell>
                                  <TableCell>
                                      {userM._id !== user._id ? (
                                          <Tooltip title="Delete User">
                                              <IconButton size='small' color='error' onClick={(e) => {
                                                  e.stopPropagation();
                                                  setConfirmUser(userM)
                                              }}>
                                                  <DeleteIcon fontSize='small'/>
                                              </IconButton>
                                          </Tooltip>
                                      ) : (
                                          <Typography fontSize={11} color='text.secondary'>You</Typography>
                                      )}
                                  </TableCell>
                                  <TableCell>
                                      {userM._id !== user._id ? (
                                          <Tooltip title={userM.isBanned ? "Unban User" : "Ban User"}>
                                              <IconButton size='small' color='warning' onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleBanUser(userM._id);
                                              }}>
                                                  <BlockIcon fontSize='small'/>
                                              </IconButton>
                                          </Tooltip>
                                      ) : (
                                          <Typography fontSize={11} color='text.secondary'>You</Typography>
                                      )}
                                  </TableCell>
                                  <TableCell>
                                      {userM._id !== user._id ? (
                                          <Tooltip title={userM.isAdmin ? "Unpromote" : "Promote"}>
                                              <IconButton size='small' color='info' onClick={(e) => {
                                                  e.stopPropagation();
                                                  handlePromoteUser(userM._id);
                                              }}>
                                                  <AdminPanelSettingsIcon fontSize='small'/>
                                              </IconButton>
                                          </Tooltip>
                                      ) : (
                                          <Typography fontSize={11} color='text.secondary'>You</Typography>
                                      )}
                                  </TableCell>
                              </TableRow>
                          )
                      })}
                  </TableBody>
              </Table>
          </Box>
      </Box>

      {
        confirmUser && (
          <ConfirmationDialog
              message={`Delete user ${confirmUser.name} ${confirmUser.lastName}?`}
              onClose={() => setConfirmUser(null)}
              onConfirm={async () => {
                  await handleDeleteUser(confirmUser._id);
                  await getUsers();
                  await fetchCards();
                  await refreshFeed();
                  setConfirmUser(null);
              }}
          />
        )
      }

    {/* Paigination */}
    <Box sx={{
      display: 'flex',
      flexDirection: {xs: 'column-reverse',md: 'row'},
      gap: {xs: 1, md: 0},
      alignItems: 'center',
      justifyContent: 'space-between',
      mt: 2,
      p: 1.5,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 3,
      bgcolor: 'background.paper'
    }}>
      <Typography fontSize={13} color='text.secondary'>
          {startPage} - {endPage} of {total} users
      </Typography>

      <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          <IconButton 
              size='small'
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
          >
              <NavigateBeforeIcon/>
          </IconButton>

          {pagesNumbers.map((page) => (
              <Button
                  key={page}
                  size='small'
                  variant={currentPage === page ? 'contained' : 'text'}
                  onClick={() => setCurrentPage(page)}
                  sx={{
                      minWidth: 32,
                      height: 32,
                      borderRadius: 2,
                      fontSize: 12
                  }}
              >
                  {page}
              </Button>
          ))}

          <IconButton 
              size='small'
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
          >
              <NavigateNextIcon/>
          </IconButton>

          <TextField
              select
              size='small'
              value={pageSize}
              onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
              }}
              sx={{
                  minWidth: 70,
                  '& .MuiOutlinedInput-root': {borderRadius: 2, fontSize: 12}
              }}
          >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
          </TextField>
      </Box>
    </Box>


  </Box>
  )
}
