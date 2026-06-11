import React, { useState, useMemo } from 'react'
import { useCardsProvider } from '../../providers/CardsProvider';
import useDebounce from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import useFavoriteCards from '../../hooks/useFavoriteCards';
import { CARD_CATEGORIES } from '../../constants/cardsCategories';
import getTimeAgo from '../../utils/getTimeAgo';
import MediaDisplay from '../../components/MediaDisplay';
import { Avatar, Box, Button, Chip, IconButton, InputAdornment, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CardPopupModal from '../../components/card/CardPopupModal';
import OnLoadingSkeletonBox from '../../components/OnLoadingSkeletonBox';
import { useUsersProvider } from '../../providers/UsersProvider';


export default function AdminCardsPanel() {

  const {loading, getUsers, users} = useUsersProvider();
  const {registeredCards, refreshFeed, fetchCards, handleDeleteCard, handleBanCard} = useCardsProvider();
  const [selectedCardId, setSelectedCardId] = useState(null);
  
  // const pageSize = 10;
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // filter cards by creator
    const [creatorId, setCreatorId] = useState('')

    // search cards by title/ text
    const [searchCard, setSearchCard] = useState('')

    const debounceSearchCard = useDebounce(searchCard, 2000);

    // favorite/ like cards
    const [favorites, setFavorites] = useState('')

    // card categories/ tags
    const [categoryFilter, setCategoryFilter] = useState('');

    const {user} = useAuth();
    const {favoriteCards} = useFavoriteCards();


  const [confirmCard, setConfirmCard] = useState(null);
 
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

  const navigate = useNavigate();

  const filteredCards = useMemo(() => {
  
    // Step 1: Choose starting data based on favorites filter:
    let result = 
    favorites === 'myFavorites' ? [...favoriteCards] : [...registeredCards];
    
    if(creatorId !== ''){
        result = result.filter(card => card.userId === creatorId)
    }

    if(debounceSearchCard !== ''){
        result = result.filter(card => card.title.toLowerCase().includes(debounceSearchCard.toLowerCase()))
    }

    if(categoryFilter !== ''){
        result = result.filter(card => card.category === categoryFilter)
    }

    result = [...result].sort((a,b) => {

      if(sortConfig.column !== ''){
        // createdAt
        if(sortConfig.column === 'createdAt'){
          if(sortConfig.direction === 'asc'){
              return new Date(a.createdAt) - new Date(b.createdAt)
            }
            else{
              return new Date(b.createdAt) - new Date(a.createdAt)
          }
        }

        // likes
        if(sortConfig.column === 'likes'){

          if(sortConfig.direction === 'asc'){
            return a.likes.length - b.likes.length
          }
          else{
            return b.likes.length - a.likes.length
          }
        }
        
        // category
        if(sortConfig.column === "categories"){
            if(sortConfig.direction === 'asc'){
                return (a.category).localeCompare(b.category);
              }
              else{
                return (b.category).localeCompare(a.category);
            }
        }

        // creator name
        if(sortConfig.column === "creators"){
            const aCreator = users.find(u => u._id === a.userId);
            const bCreator = users.find(u => u._id === b.userId);

            if(sortConfig.direction === 'asc'){
                return (aCreator?.name || '').localeCompare(bCreator?.name || '');
              }
              else{
                return (bCreator?.name || '').localeCompare(aCreator?.name || '');
            }
        }
      }
    })
  
      return result;
  }, [creatorId, registeredCards, debounceSearchCard, categoryFilter, favorites, sortConfig, users])

  const totalPages = Math.ceil(filteredCards.length / pageSize);

  const numbersArray = (num) => {
    return Array.from({length: num}, (_, i) => i + 1);
  }
  const pagesNumbers = numbersArray(totalPages) // [1,2,3]

  const sliced = filteredCards.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const start = (currentPage - 1) * pageSize + 1;
  const endPage = Math.min(currentPage * pageSize ,filteredCards.length)
  const total = filteredCards.length

  const headCellSx = {fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap'}
  const sortableSx = {...headCellSx, cursor: 'pointer', userSelect: 'none'}
  
  if(loading) return <OnLoadingSkeletonBox/>

  return(
    <Box sx={{my: 2, m: {xs: 1,md:2}}}>

      {/* Page Header */}
      <Box mb={3}>
          <Typography fontSize={25} fontWeight={700}>Posts Management</Typography>
          <Typography fontSize={14} color='text.secondary'>
              {total} posts found
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
              placeholder='Search by title...'
              value={searchCard}
              onChange={(e) => {
                  setSearchCard(e.target.value)
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
              sx={{minWidth: {xs: '100%', md:200}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
          />

          <TextField
              select
              size='small'
              value={creatorId}
              onChange={(e) => {
                  setCreatorId(e.target.value)
                  setCurrentPage(1)
              }}
              slotProps={{
                  select: {
                      displayEmpty: true,
                      renderValue: (value) => {
                          if(!value) return 'All Users'
                          const found = users.find(u => u._id === value)
                          return found ? found.name + ' ' + found.lastName : 'All Users'
                      }
                  }
              }}
              sx={{minWidth: {xs: '100%', md:150}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
          >
              <MenuItem value="">All Users</MenuItem>
              {users.map((userM) => (
                  <MenuItem key={userM._id} value={userM._id}>{userM.name} {userM.lastName}</MenuItem>
              ))}
          </TextField>

          <TextField
              select
              size='small'
              value={categoryFilter}
              onChange={(e) => {
                  setCategoryFilter(e.target.value)
                  setCurrentPage(1)
              }}
              slotProps={{
                  select: {
                      displayEmpty: true,
                      renderValue: (value) => value || 'All Categories'
                  }
              }}
              sx={{minWidth: {xs: '100%', md:150}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
          >
              <MenuItem value="">All Categories</MenuItem>
              {CARD_CATEGORIES.map((category, index) => (
                  <MenuItem key={index} value={category}>{category}</MenuItem>
              ))}
          </TextField>

          <TextField
              select
              size='small'
              value={favorites}
              onChange={(e) => {
                  setFavorites(e.target.value)
                  setCurrentPage(1)
              }}
              slotProps={{
                  select: {
                      displayEmpty: true,
                      renderValue: (value) => value === 'myFavorites' ? 'My Favorites' : 'All Posts'
                  }
              }}
              sx={{minWidth: {xs: '100%', md:140}, '& .MuiOutlinedInput-root': {borderRadius: 5, fontSize: 13}}}
          >
              <MenuItem value="">All Posts</MenuItem>
              <MenuItem value="myFavorites">My Favorites</MenuItem>
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
              <Table size='small' sx={{
                  minWidth: 1200,
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
              }}>
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
                          <TableCell 
                              sx={sortableSx}
                              onClick={() => handleSortTable('creators')}
                          >
                              Creator {sortConfig.column === 'creators' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </TableCell>
                          <TableCell sx={headCellSx}>Thumbnail</TableCell>
                          <TableCell sx={headCellSx}>Title</TableCell>
                          <TableCell 
                              sx={sortableSx}
                              onClick={() => handleSortTable('categories')}
                          >
                              Category {sortConfig.column === 'categories' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </TableCell>
                          <TableCell 
                              sx={sortableSx}
                              onClick={() => handleSortTable('createdAt')}
                          >
                              Created {sortConfig.column === 'createdAt' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </TableCell>
                          <TableCell 
                              sx={sortableSx}
                              onClick={() => handleSortTable('likes')}
                          >
                              Likes {sortConfig.column === 'likes' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                          </TableCell>
                          <TableCell sx={headCellSx}>Comments</TableCell>
                          <TableCell sx={headCellSx}>Delete</TableCell>
                          <TableCell sx={headCellSx}>Ban</TableCell>
                          <TableCell sx={headCellSx}>Status</TableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                      {sliced.map((card, indexM) => {
                          const creator = users.find(u => u._id === card.userId);

                          return (
                              <TableRow 
                                  key={card._id}
                                  hover
                                  onClick={() => setSelectedCardId(card._id)}
                                  sx={{cursor: 'pointer'}}
                              >
                                  <TableCell>{indexM + (currentPage - 1) * pageSize + 1}</TableCell>
                                  <TableCell>
                                      <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                          <Avatar src={creator?.profilePicture} sx={{width: 32, height: 32}}/>
                                          <Typography fontSize={13} fontWeight={500} noWrap>
                                              {creator?.name} {creator?.lastName}
                                          </Typography>
                                      </Box>
                                  </TableCell>
                                  <TableCell>
                                      <MediaDisplay
                                          mediaUrl={card.mediaUrl}
                                          mediaType={card.mediaType}
                                          style={{
                                              width: 60,
                                              height: 60,
                                              borderRadius: 8,
                                              objectFit: 'cover'
                                          }}
                                      />
                                  </TableCell>
                                  <TableCell sx={{fontWeight: 500, maxWidth: 200}}>
                                      <Typography fontSize={13} noWrap>{card.title}</Typography>
                                  </TableCell>
                                  <TableCell>
                                      <Chip label={card.category} size='small' sx={{fontSize: 11}}/>
                                  </TableCell>
                                  <TableCell sx={{color: 'text.secondary', fontSize: 12}}>{getTimeAgo(card.createdAt)}</TableCell>
                                  <TableCell sx={{fontWeight: 600}}>{card.likes.length}</TableCell>
                                  <TableCell sx={{fontWeight: 600}}>{card.comments.length}</TableCell>
                                  <TableCell>
                                      {creator?._id !== user._id ? (
                                          <Tooltip title="Delete Post">
                                              <IconButton size='small' color='error' onClick={(e) => {
                                                  e.stopPropagation();
                                                  setConfirmCard(card)
                                              }}>
                                                  <DeleteIcon fontSize='small'/>
                                              </IconButton>
                                          </Tooltip>
                                      ) : (
                                          <Typography fontSize={11} color='text.secondary'>You</Typography>
                                      )}
                                  </TableCell>
                                  <TableCell>
                                      {creator?._id !== user._id ? (
                                          <Tooltip title={card.isBanned ? "Unban Post" : "Ban Post"}>
                                              <IconButton size='small' color='warning' onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleBanCard(card._id);
                                              }}>
                                                  <BlockIcon fontSize='small'/>
                                              </IconButton>
                                          </Tooltip>
                                      ) : (
                                          <Typography fontSize={11} color='text.secondary'>You</Typography>
                                      )}
                                  </TableCell>
                                  <TableCell>
                                      <Chip 
                                          label={card.isBanned ? "Banned" : "Active"} 
                                          size='small'
                                          sx={{
                                              bgcolor: card.isBanned ? 'error.main' : 'success.main',
                                              color: 'white',
                                              fontWeight: 600,
                                              fontSize: 11
                                          }}
                                      />
                                  </TableCell>
                              </TableRow>
                          )
                      })}
                  </TableBody>
              </Table>
          </Box>
      </Box>
      

      {/* open card popup modal */}
      {selectedCardId && (
        <CardPopupModal
            cardId = {selectedCardId}
            onClose = {() => setSelectedCardId(null)}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmCard && (
          <ConfirmationDialog
              message={`Delete card: ${confirmCard.title}?`}
              onClose={() => setConfirmCard(null)}
              onConfirm={async () => {
                  await handleDeleteCard(confirmCard._id);
                  await getUsers();
                  await fetchCards();
                  await refreshFeed();
                  setConfirmCard(null);
              }}
          />
      )}

      {/* Pagination */}
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
              {start} - {endPage} of {total} posts
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
