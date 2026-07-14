import React, { useState, useMemo, useEffect, useCallback } from 'react'
import useDebounce from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/authContext';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import CountryFlag from '../../components/CountryFlag';
import { Box, CircularProgress, InputAdornment, MenuItem, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Avatar, Button, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useOffsetPagination } from '../../hooks/useOffsetPagination';
import { getAdminUsers, banUser, promoteUser, deleteUser, getUserCountries } from '../../services/apiService';

export default function AdminUsersPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 2000);
  const [ageSort, setAgeSort] = useState('');
  const [nameSort, setNameSort] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ column: '', direction: 'asc' });
  const [countries, setCountries] = useState([]);

  // ── Confirmation dialog ──────────────────────────────────────────────────────
  const [confirmUser, setConfirmUser] = useState(null);

  // ── Server-side pagination ───────────────────────────────────────────────────
  const fetchPage = useCallback((params) => getAdminUsers(params), []);
  const pagination = useOffsetPagination(fetchPage);
  const { items, total, page, pageSize, loading, error, refresh, setPage, setPageSize, refetch } = pagination;

  // Derive a single sort param string from the combined sort UI state.
  // Column header sort overrides dropdown sorts (matches original priority).
  const sortParam = useMemo(() => {
    if (sortConfig.column) {
      const d = sortConfig.direction;
      switch (sortConfig.column) {
        case 'joined':    return d === 'asc' ? 'joined_asc' : 'joined';
        case 'posts':     return d === 'asc' ? 'posts_asc' : 'posts';
        case 'followers': return d === 'asc' ? 'followers_asc' : 'followers';
        default: break;
      }
    }
    if (nameSort === 'az') return 'name_asc';
    if (nameSort === 'za') return 'name_desc';
    if (ageSort === 'low') return 'age';
    if (ageSort === 'high') return 'age_desc';
    return 'joined';
  }, [sortConfig, nameSort, ageSort]);

  // Re-fetch whenever any filter or sort changes (refresh always resets to page 1).
  useEffect(() => {
    refresh({
      search: debouncedSearch,
      gender: genderFilter,
      country: countryFilter,
      role: roleFilter,
      sort: sortParam,
    });
    // `refresh` is stable (stable fetcher → stable doLoad → stable refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, genderFilter, countryFilter, roleFilter, sortParam]);

  // Load country options from the server once.
  useEffect(() => {
    getUserCountries().then(r => setCountries(r.countries || [])).catch(() => {});
  }, []);

  // ── Sort column header handler ───────────────────────────────────────────────
  const handleSortTable = (column) => {
    // Clicking a column header clears the dropdown sorts.
    setAgeSort('');
    setNameSort('');
    setSortConfig(prev =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' }
    );
  };

  // ── Mutations ────────────────────────────────────────────────────────────────
  const handleBanUser = async (userId) => {
    await banUser(userId);
    refetch();
  };

  const handlePromoteUser = async (userId) => {
    await promoteUser(userId);
    refetch();
  };

  const handleDeleteUser = async (userId) => {
    await deleteUser(userId);
    refetch();
  };

  // ── Derived pagination values ────────────────────────────────────────────────
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
        <Typography fontSize={25} fontWeight={700}>Users Management</Typography>
        <Typography fontSize={14} color='text.secondary'>
          {loading ? 'Loading…' : `${total} users found`}
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
        <TextField
          size='small'
          placeholder='Search by name...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'>
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: { xs: '100%', md: 200 },
            '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 },
          }}
        />

        <TextField
          select
          size='small'
          value={ageSort}
          onChange={(e) => {
            setAgeSort(e.target.value);
            setSortConfig({ column: '', direction: 'asc' });
          }}
          disabled={!!nameSort}
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (v) => v === '' ? 'All Ages' : v === 'low' ? 'Low → High' : 'High → Low',
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 130 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        >
          <MenuItem value=''>All Ages</MenuItem>
          <MenuItem value='low'>Low → High</MenuItem>
          <MenuItem value='high'>High → Low</MenuItem>
        </TextField>

        <TextField
          select
          size='small'
          value={nameSort}
          onChange={(e) => {
            setNameSort(e.target.value);
            setSortConfig({ column: '', direction: 'asc' });
          }}
          disabled={!!ageSort}
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (v) => v === '' ? 'A/Z Mixed' : v === 'az' ? 'A → Z' : 'Z → A',
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 130 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        >
          <MenuItem value=''>A/Z Mixed</MenuItem>
          <MenuItem value='az'>A → Z</MenuItem>
          <MenuItem value='za'>Z → A</MenuItem>
        </TextField>

        <TextField
          select
          size='small'
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (v) => v === '' ? 'All Genders' : v,
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 130 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        >
          <MenuItem value=''>All Genders</MenuItem>
          <MenuItem value='Male'>Male</MenuItem>
          <MenuItem value='Female'>Female</MenuItem>
        </TextField>

        <TextField
          select
          size='small'
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (v) => v === '' ? 'All Roles' : v,
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 130 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        >
          <MenuItem value=''>All Roles</MenuItem>
          <MenuItem value='admin'>Admin</MenuItem>
          <MenuItem value='user'>User</MenuItem>
        </TextField>

        <TextField
          select
          size='small'
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (v) => v || 'All Countries',
            },
          }}
          sx={{ minWidth: { xs: '100%', md: 150 }, '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: 13 } }}
        >
          <MenuItem value=''>All Countries</MenuItem>
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
        bgcolor: 'background.paper',
        position: 'relative',
      }}>
        {/* Loading overlay */}
        {loading && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'background.paper',
            opacity: 0.7,
          }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color='error' fontSize={14}>{error.message || 'Failed to load users.'}</Typography>
          </Box>
        )}

        <Box sx={{ overflowX: 'auto' }}>
          <Table
            size='small'
            sx={{
              minWidth: 1400,
              '& .MuiTableCell-root': { border: 'none', py: 2, fontSize: 13 },
              '& .MuiTableBody-root .MuiTableRow-root': { borderBottom: '1px solid', borderColor: 'divider' },
              '& .MuiTableBody-root .MuiTableRow-root:last-child': { borderBottom: 'none' },
            }}
          >
            <TableHead sx={{
              '& .MuiTableCell-root': {
                color: 'text.secondary', fontWeight: 600, fontSize: 12, border: 'none', pb: 1.5,
              },
            }}>
              <TableRow>
                <TableCell sx={headCellSx}>#</TableCell>
                <TableCell sx={headCellSx}>Profile</TableCell>
                <TableCell sx={headCellSx}>Name</TableCell>
                <TableCell sx={headCellSx}>Email</TableCell>
                <TableCell sx={headCellSx}>Last Login</TableCell>
                <TableCell sx={headCellSx}>Country</TableCell>
                <TableCell sx={sortableSx} onClick={() => handleSortTable('joined')}>
                  Joined {sortConfig.column === 'joined' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </TableCell>
                <TableCell sx={sortableSx} onClick={() => handleSortTable('posts')}>
                  Posts {sortConfig.column === 'posts' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </TableCell>
                <TableCell sx={sortableSx} onClick={() => handleSortTable('followers')}>
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
              {items.map((userM, indexM) => (
                <TableRow
                  key={userM._id}
                  hover
                  onClick={() => navigate(`/profiledashboard/${userM._id}/profilemain`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontSize: 13 }}>{startItem + indexM}</TableCell>
                  <TableCell>
                    <Avatar src={userM.profilePicture} sx={{ width: 36, height: 36 }} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap' }}>
                    {userM.name} {userM.lastName}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{userM.email}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                    {userM.lastLoginAt?.split('T')[0]}
                  </TableCell>
                  <TableCell>
                    <CountryFlag country={userM.address?.country} width={30} sx={{ height: 20 }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{userM.createdAt?.split('T')[0]}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{userM.postsCount ?? 0}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{userM.followersCount ?? 0}</TableCell>
                  <TableCell>
                    <Chip
                      label={userM.isAdmin ? 'Admin' : 'User'}
                      size='small'
                      sx={{
                        bgcolor: userM.isAdmin ? 'primary.main' : 'action.selected',
                        color: userM.isAdmin ? 'white' : 'text.secondary',
                        fontWeight: 600, fontSize: 11,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={userM.isBanned ? 'Banned' : 'Active'}
                      size='small'
                      sx={{
                        bgcolor: userM.isBanned ? 'error.main' : 'success.main',
                        color: 'white', fontWeight: 600, fontSize: 11,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {userM._id !== user._id ? (
                      <Tooltip title='Delete User'>
                        <IconButton size='small' color='error' onClick={(e) => {
                          e.stopPropagation();
                          setConfirmUser(userM);
                        }}>
                          <DeleteIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography fontSize={11} color='text.secondary'>You</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {userM._id !== user._id ? (
                      <Tooltip title={userM.isBanned ? 'Unban User' : 'Ban User'}>
                        <IconButton size='small' color='warning' onClick={(e) => {
                          e.stopPropagation();
                          handleBanUser(userM._id);
                        }}>
                          <BlockIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography fontSize={11} color='text.secondary'>You</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {userM._id !== user._id ? (
                      <Tooltip title={userM.isAdmin ? 'Unpromote' : 'Promote'}>
                        <IconButton size='small' color='info' onClick={(e) => {
                          e.stopPropagation();
                          handlePromoteUser(userM._id);
                        }}>
                          <AdminPanelSettingsIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography fontSize={11} color='text.secondary'>You</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>

      {/* Delete confirmation */}
      {confirmUser && (
        <ConfirmationDialog
          message={`Delete user ${confirmUser.name} ${confirmUser.lastName}?`}
          onClose={() => setConfirmUser(null)}
          onConfirm={async () => {
            await handleDeleteUser(confirmUser._id);
            setConfirmUser(null);
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
          {total === 0 ? '0 users' : `${startItem} - ${endItem} of ${total} users`}
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
