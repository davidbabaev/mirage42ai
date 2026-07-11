import React, { useState, useCallback, useEffect } from 'react'
import useDebounce from '../../hooks/useDebounce';
import { useAuth } from '../../providers/AuthProvider';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { CARD_CATEGORIES } from '../../constants/cardsCategories';
import getTimeAgo from '../../utils/getTimeAgo';
import MediaDisplay from '../../components/MediaDisplay';
import {
  Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, InputAdornment, List, ListItem, ListItemAvatar, ListItemText,
  MenuItem, Skeleton, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import FlagIcon from '@mui/icons-material/Flag';
import CloseIcon from '@mui/icons-material/Close';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CardPopupModal from '../../components/card/CardPopupModal';
import { useOffsetPagination } from '../../hooks/useOffsetPagination';
import { getAdminCards, banCard, deleteCard, getCardReports } from '../../services/apiService';

const REASON_LABELS = {
  spam: 'Spam',
  harassment: 'Harassment',
  nudity: 'Nudity or Sexual Content',
  hate: 'Hate Speech',
  violence: 'Violence',
  misinformation: 'Misinformation',
  other: 'Other',
};

export default function AdminCardsPanel() {
  const { user } = useAuth();
  const [selectedCardId, setSelectedCardId] = useState(null);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [searchCard, setSearchCard] = useState('');
  const debouncedSearch = useDebounce(searchCard, 2000);
  // Creator: free-text search (server-side name match; scales to 100k+ users)
  const [creatorSearch, setCreatorSearch] = useState('');
  const debouncedCreator = useDebounce(creatorSearch, 2000);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState({ column: '', direction: 'asc' });

  const handleSortTable = (column) => {
    setSortConfig(prev =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' }
    );
  };

  // Map UI sort state → server sort param
  const deriveSortParam = () => {
    if (!sortConfig.column) return 'newest';
    const d = sortConfig.direction;
    switch (sortConfig.column) {
      case 'createdAt':  return d === 'asc' ? 'oldest' : 'newest';
      case 'likes':      return d === 'asc' ? 'likes_asc' : 'likes';
      case 'categories': return d === 'asc' ? 'category' : 'category_desc';
      case 'creators':   return d === 'asc' ? 'creator' : 'creator_desc';
      default: return 'newest';
    }
  };

  // ── Confirmation dialog ───────────────────────────────────────────────────────
  const [confirmCard, setConfirmCard] = useState(null);

  // ── Reporter list modal ───────────────────────────────────────────────────────
  const [reportModalCardId, setReportModalCardId] = useState(null);
  const [reporters, setReporters] = useState([]);
  const [reportersLoading, setReportersLoading] = useState(false);
  const [reportersError, setReportersError] = useState(null);

  const openReporterModal = useCallback(async (cardId) => {
    setReportModalCardId(cardId);
    setReporters([]);
    setReportersError(null);
    setReportersLoading(true);
    try {
      const data = await getCardReports(cardId);
      setReporters(data);
    } catch (err) {
      setReportersError(err.message || 'Failed to load reporters.');
    } finally {
      setReportersLoading(false);
    }
  }, []);

  const closeReporterModal = useCallback(() => {
    setReportModalCardId(null);
    setReporters([]);
    setReportersError(null);
  }, []);

  // ── Server-side pagination ────────────────────────────────────────────────────
  const fetchPage = useCallback((params) => getAdminCards(params), []);
  const {
    items, total, page, pageSize, loading, error,
    refresh, setPage, setPageSize, refetch,
  } = useOffsetPagination(fetchPage);

  // Re-fetch whenever any filter or sort changes.
  useEffect(() => {
    refresh({
      search: debouncedSearch,
      creator: debouncedCreator,
      category: categoryFilter,
      status: statusFilter,
      sort: deriveSortParam(),
    });
    // `refresh` is stable; `deriveSortParam` is a closure over `sortConfig`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedCreator, categoryFilter, statusFilter, sortConfig]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const handleBanCard = async (cardId) => {
    await banCard(cardId);
    refetch();
  };

  const handleDeleteCard = async (cardId) => {
    await deleteCard(cardId);
    refetch();
  };

  // ── Derived pagination values ─────────────────────────────────────────────────
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const headCellSx = { fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' };
  const sortableSx = { ...headCellSx, cursor: 'pointer', userSelect: 'none' };

  return (
    <Box sx={{ my: 2, m: { xs: 1, md: 2 } }}>
      {/* Page Header */}
      <Box mb={3}>
        <Typography fontSize={25} fontWeight={700}>Posts Management</Typography>
        <Typography fontSize={14} color='text.secondary'>
          {loading ? 'Loading…' : `${total} posts found`}
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 1, md: 2 },
        flexWrap: 'wrap',
        alignItems: 'center',
        mb: 3,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
      }}>
        {/* Title search */}
        <TextField
          size='small'
          placeholder='Search by title...'
          value={searchCard}
          onChange={(e) => setSearchCard(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'><SearchIcon /></InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 200 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        />

        {/* Creator name search (text input — scales to 100k+ users) */}
        <TextField
          size='small'
          placeholder='Search by creator...'
          value={creatorSearch}
          onChange={(e) => setCreatorSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'><SearchIcon /></InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 180 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        />

        {/* Category filter */}
        <TextField
          select
          size='small'
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (v) => v || 'All Categories',
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 150 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        >
          <MenuItem value=''>All Categories</MenuItem>
          {CARD_CATEGORIES.map((cat) => (
            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
          ))}
        </TextField>

        {/* Status filter — admin sees all statuses; this lets them focus on one */}
        <TextField
          select
          size='small'
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (v) => {
                if (!v) return 'All Statuses';
                return v.charAt(0).toUpperCase() + v.slice(1);
              },
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 140 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        >
          <MenuItem value=''>All Statuses</MenuItem>
          <MenuItem value='active'>Active</MenuItem>
          <MenuItem value='banned'>Banned</MenuItem>
          <MenuItem value='deleted'>Deleted</MenuItem>
        </TextField>
      </Box>

      {/* Table */}
      <Box sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        position: 'relative',
      }}>
        {/* Loading overlay */}
        {loading && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'background.paper', opacity: 0.7,
          }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color='error' fontSize={14}>{error.message || 'Failed to load posts.'}</Typography>
          </Box>
        )}

        <Box sx={{ overflowX: 'auto' }}>
          <Table size='small' sx={{
            minWidth: 1200,
            '& .MuiTableCell-root': { border: 'none', py: 2, fontSize: 13 },
            '& .MuiTableBody-root .MuiTableRow-root': { borderBottom: '1px solid', borderColor: 'divider' },
            '& .MuiTableBody-root .MuiTableRow-root:last-child': { borderBottom: 'none' },
          }}>
            <TableHead sx={{
              '& .MuiTableCell-root': {
                color: 'text.secondary', fontWeight: 600, fontSize: 12, border: 'none', pb: 1.5,
              },
            }}>
              <TableRow>
                <TableCell sx={headCellSx}>#</TableCell>
                <TableCell sx={sortableSx} onClick={() => handleSortTable('creators')}>
                  Creator {sortConfig.column === 'creators' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </TableCell>
                <TableCell sx={headCellSx}>Thumbnail</TableCell>
                <TableCell sx={headCellSx}>Title</TableCell>
                <TableCell sx={sortableSx} onClick={() => handleSortTable('categories')}>
                  Category {sortConfig.column === 'categories' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </TableCell>
                <TableCell sx={sortableSx} onClick={() => handleSortTable('createdAt')}>
                  Created {sortConfig.column === 'createdAt' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </TableCell>
                <TableCell sx={sortableSx} onClick={() => handleSortTable('likes')}>
                  Likes {sortConfig.column === 'likes' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </TableCell>
                <TableCell sx={headCellSx}>Comments</TableCell>
                <TableCell sx={headCellSx}>Delete</TableCell>
                <TableCell sx={headCellSx}>Ban</TableCell>
                <TableCell sx={headCellSx}>Status</TableCell>
                <TableCell sx={headCellSx}>Reports</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((card, indexM) => {
                const creator = card.creator;
                return (
                  <TableRow
                    key={card._id}
                    hover
                    onClick={() => setSelectedCardId(card._id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{startItem + indexM}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar src={creator?.profilePicture} sx={{ width: 32, height: 32 }} />
                        <Typography fontSize={13} fontWeight={500} noWrap>
                          {creator?.name} {creator?.lastName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <MediaDisplay
                        mediaUrl={card.mediaUrl}
                        mediaType={card.mediaType}
                        style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, maxWidth: 200 }}>
                      <Typography fontSize={13} noWrap>{card.title}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={card.category} size='small' sx={{ fontSize: 11 }} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {getTimeAgo(card.createdAt)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{card.likesCount ?? 0}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{card.commentsCount ?? 0}</TableCell>
                    <TableCell>
                      {creator?._id !== user?._id ? (
                        <Tooltip title='Delete Post'>
                          <IconButton size='small' color='error' onClick={(e) => {
                            e.stopPropagation();
                            setConfirmCard(card);
                          }}>
                            <DeleteIcon fontSize='small' />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography fontSize={11} color='text.secondary'>You</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {creator?._id !== user?._id ? (
                        <Tooltip title={card.status === 'banned' ? 'Unban Post' : 'Ban Post'}>
                          <IconButton size='small' color='warning' onClick={(e) => {
                            e.stopPropagation();
                            handleBanCard(card._id);
                          }}>
                            <BlockIcon fontSize='small' />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography fontSize={11} color='text.secondary'>You</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={card.status === 'banned' ? 'Banned' : 'Active'}
                        size='small'
                        sx={{
                          bgcolor: card.status === 'banned' ? 'error.main' : 'success.main',
                          color: 'white', fontWeight: 600, fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {card.reportCount > 0 ? (
                        <Button
                          size='small'
                          variant='contained'
                          color='warning'
                          startIcon={<FlagIcon sx={{ fontSize: 14 }} />}
                          aria-label={`View ${card.reportCount} reporters`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openReporterModal(card._id);
                          }}
                          sx={{
                            minWidth: 0, fontSize: 12, fontWeight: 700,
                            px: 1, py: 0.25, lineHeight: 1.5,
                          }}
                        >
                          {card.reportCount}
                        </Button>
                      ) : (
                        <Typography fontSize={12} color='text.disabled'>0</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Box>

      {/* Card popup modal */}
      {selectedCardId && (
        <CardPopupModal cardId={selectedCardId} onClose={() => setSelectedCardId(null)} />
      )}

      {/* Reporter list modal */}
      <Dialog
        open={!!reportModalCardId}
        onClose={closeReporterModal}
        fullWidth
        maxWidth='sm'
        PaperProps={{
          sx: { mx: { xs: 1, sm: 2 }, width: { xs: '100%', sm: 'auto' } },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlagIcon color='warning' fontSize='small' />
            <Typography fontWeight={600} fontSize={16}>Reporters</Typography>
          </Box>
          <IconButton size='small' onClick={closeReporterModal} aria-label='Close reporters modal'>
            <CloseIcon fontSize='small' />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, maxHeight: { xs: '70dvh', sm: 480 }, overflowY: 'auto' }}>
          {reportersLoading && (
            <List disablePadding>
              {[1, 2, 3].map((i) => (
                <ListItem key={i} divider sx={{ gap: 1.5, py: 1.5, px: 2 }}>
                  <Skeleton variant='circular' width={36} height={36} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width='60%' height={18} />
                    <Skeleton width='40%' height={14} />
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
          {!reportersLoading && reportersError && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color='error' fontSize={13}>{reportersError}</Typography>
            </Box>
          )}
          {!reportersLoading && !reportersError && reporters.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color='text.secondary' fontSize={13}>No reports found.</Typography>
            </Box>
          )}
          {!reportersLoading && !reportersError && reporters.length > 0 && (
            <List disablePadding>
              {reporters.map((r) => (
                <ListItem key={r._id} divider sx={{ gap: 0, py: 1.5, px: 2, alignItems: 'flex-start' }}>
                  <ListItemAvatar sx={{ minWidth: 48 }}>
                    <Avatar src={r.reporter?.profilePicture} sx={{ width: 36, height: 36 }}>
                      {r.reporter?.name?.[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography fontSize={13} fontWeight={600}>
                        {r.reporter?.name} {r.reporter?.lastName}
                      </Typography>
                    }
                    secondary={
                      <Box component='span' sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                        <Chip
                          label={REASON_LABELS[r.reason] ?? r.reason}
                          size='small'
                          color='warning'
                          variant='outlined'
                          sx={{ fontSize: 11, width: 'fit-content' }}
                        />
                        <Typography component='span' fontSize={11} color='text.secondary'>
                          {getTimeAgo(r.createdAt)}
                        </Typography>
                      </Box>
                    }
                    slotProps={{ secondary: { component: 'div' } }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      {confirmCard && (
        <ConfirmationDialog
          message={`Delete card: ${confirmCard.title}?`}
          onClose={() => setConfirmCard(null)}
          onConfirm={async () => {
            await handleDeleteCard(confirmCard._id);
            setConfirmCard(null);
          }}
        />
      )}

      {/* Pagination */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column-reverse', md: 'row' },
        gap: { xs: 1, md: 0 },
        alignItems: 'center',
        justifyContent: 'space-between',
        mt: 2,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
      }}>
        <Typography fontSize={13} color='text.secondary'>
          {total === 0 ? '0 posts' : `${startItem} - ${endItem} of ${total} posts`}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          <IconButton size='small' disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>
            <NavigateBeforeIcon />
          </IconButton>

          {pageNumbers.map((p) => (
            <Button
              key={p}
              size='small'
              variant={page === p ? 'contained' : 'text'}
              disabled={loading}
              onClick={() => setPage(p)}
              sx={{ minWidth: 32, height: 32, borderRadius: 2, fontSize: 12 }}
            >
              {p}
            </Button>
          ))}

          <IconButton size='small' disabled={page === totalPages || loading || totalPages === 0} onClick={() => setPage(page + 1)}>
            <NavigateNextIcon />
          </IconButton>

          <TextField
            select
            size='small'
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            sx={{ minWidth: 70, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12 } }}
          >
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={25}>25</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
          </TextField>
        </Box>
      </Box>
    </Box>
  );
}
