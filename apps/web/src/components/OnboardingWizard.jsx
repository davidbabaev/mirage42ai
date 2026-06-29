import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    Stepper,
    Step,
    StepLabel,
    Box,
    Typography,
    Chip,
    Button,
    Avatar,
    TextField,
    Skeleton,
    Alert,
    useTheme,
    useMediaQuery,
    InputAdornment,
    CircularProgress,
    MenuItem,
    Autocomplete,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckIcon from '@mui/icons-material/Check';
import { useAuth } from '../providers/AuthProvider';
import { getSuggestedUsers, updateOnboarding, searchUsers } from '../services/apiService';
import { CARD_CATEGORIES } from '../constants/cardsCategories';
import { JOB_INDUSTRIES } from '../constants/usersJobIndustries';
import isProfileIncomplete from '../utils/isProfileIncomplete';
import useFollowUser from '../hooks/useFollowUser';
import useDebounce from '../hooks/useDebounce';
import useCountries from '../hooks/useCountries';
import useCities from '../hooks/useCities';

const REDUCED_MOTION =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

// ─── Main wizard ───────────────────────────────────────────────────────────────
export default function OnboardingWizard() {
    const { user, setUser, isLoggedIn, editUser } = useAuth();
    const { toggleFollow, isFollowByMe } = useFollowUser();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Derived: show only if authenticated + onboarding not done
    const open = !!(isLoggedIn && user?.onboardingComplete === false);

    // Build step list dynamically — finish-profile step is ONLY for Google-login
    // users (form-registered users already provided this data at sign-up).
    const needsProfile = user ? (Boolean(user.googleId) && isProfileIncomplete(user)) : false;
    const steps = needsProfile
        ? ['Pick Interests', 'Suggested People', 'Finish Profile']
        : ['Pick Interests', 'Suggested People'];

    // ── Wizard state ────────────────────────────────────────────────────────────
    const [activeStep, setActiveStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const stepHeadingRef = useRef(null);

    // Step 1 — interests
    const [selectedInterests, setSelectedInterests] = useState([]);

    // Step 2 — suggested people
    const [suggestedUsers, setSuggestedUsers] = useState([]);
    const [suggestedLoading, setSuggestedLoading] = useState(false);
    const [suggestedError, setSuggestedError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const debouncedSearch = useDebounce(searchQuery, 400);

    // Step 3 — profile fields
    const [profileValues, setProfileValues] = useState({});
    const [profileError, setProfileError] = useState(null);

    // ── Focus step heading on step change ───────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => stepHeadingRef.current?.focus(), 120);
        return () => clearTimeout(t);
    }, [activeStep, open]);

    // ── Pre-fill profile form from user context ──────────────────────────────────
    useEffect(() => {
        if (!user) return;
        setProfileValues({
            job:       user.job === 'Not Defined'      ? '' : (user.job      || ''),
            phone:     user.phone                      || '',
            age:       user.age                        || '',
            gender:    user.gender === 'Unknown'       ? '' : (user.gender   || ''),
            aboutMe:   user.aboutMe === 'Not Defined'  ? '' : (user.aboutMe  || ''),
            country:   user.address?.country === 'Not Defined' ? '' : (user.address?.country || ''),
            city:      user.address?.city              || '',
            birthDate: user.birthDate                  || '',
        });
    }, [user?._id]);

    // ── Fetch suggested users when entering step 2 ──────────────────────────────
    useEffect(() => {
        if (activeStep !== 1 || !open) return;
        let cancelled = false;
        setSuggestedLoading(true);
        setSuggestedError(null);
        getSuggestedUsers(20)
            .then((data) => { if (!cancelled) setSuggestedUsers(data.users || []); })
            .catch((err) => { if (!cancelled) setSuggestedError(err.message || 'Failed to load suggestions'); })
            .finally(() => { if (!cancelled) setSuggestedLoading(false); });
        return () => { cancelled = true; };
    }, [activeStep, open]);

    // ── Search users (debounced) ─────────────────────────────────────────────────
    useEffect(() => {
        if (!debouncedSearch.trim()) {
            setSearchResults([]);
            return;
        }
        let cancelled = false;
        setSearchLoading(true);
        searchUsers(debouncedSearch, 10)
            .then((data) => { if (!cancelled) setSearchResults(Array.isArray(data) ? data : []); })
            .catch(() => { if (!cancelled) setSearchResults([]); })
            .finally(() => { if (!cancelled) setSearchLoading(false); });
        return () => { cancelled = true; };
    }, [debouncedSearch]);

    // ── Complete onboarding (PATCH /users/me/onboarding) ────────────────────────
    const completeOnboarding = useCallback(async (interests) => {
        setSaving(true);
        try {
            const updated = await updateOnboarding({ interests, onboardingComplete: true });
            setUser(updated);
        } catch (err) {
            // Fail silently — user lands on feed; wizard won't reopen if localStorage
            // already has the updated user (setUser persists it).
            console.error('onboarding update failed', err.message);
        } finally {
            setSaving(false);
        }
    }, [setUser]);

    // ── Action handlers ──────────────────────────────────────────────────────────
    const handleSkip = () => completeOnboarding(selectedInterests);

    const handleBack = () => {
        setActiveStep((s) => s - 1);
        setProfileError(null);
    };

    const handleNext = async () => {
        const isLastStep = activeStep === steps.length - 1;

        if (!isLastStep) {
            setActiveStep((s) => s + 1);
            return;
        }

        // Last step: save profile if we're on the profile step
        if (needsProfile) {
            setSaving(true);
            setProfileError(null);
            const fd = new FormData();
            fd.append('name',     user.name);
            fd.append('lastName', user.lastName || '');
            fd.append('email',    user.email);
            if (profileValues.country)   fd.append('address[country]', profileValues.country);
            if (profileValues.city)      fd.append('address[city]',    profileValues.city);
            if (profileValues.job)       fd.append('job',       profileValues.job);
            if (profileValues.phone)     fd.append('phone',     profileValues.phone);
            if (profileValues.age)       fd.append('age',       profileValues.age);
            if (profileValues.gender)    fd.append('gender',    profileValues.gender);
            if (profileValues.birthDate) fd.append('birthDate', profileValues.birthDate);
            if (profileValues.aboutMe)   fd.append('aboutMe',   profileValues.aboutMe);
            const result = await editUser(user._id, fd);
            setSaving(false);
            if (!result.success) {
                setProfileError(result.message);
                return;
            }
        }

        await completeOnboarding(selectedInterests);
    };

    const toggleInterest = (cat) =>
        setSelectedInterests((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        );

    if (!open) return null;

    const isLastStep = activeStep === steps.length - 1;

    // ── Step titles + subtitles ──────────────────────────────────────────────────
    const STEP_TITLE = [
        "What are you into?",
        "People to follow",
        "Finish your profile",
    ];
    const STEP_SUBTITLE = [
        "Pick topics you love — we'll personalise your feed.",
        "Follow people to get their posts in your feed.",
        "A complete profile helps others discover you.",
    ];

    return (
        <Dialog
            open={open}
            fullScreen={isMobile}
            maxWidth="sm"
            fullWidth
            disableEscapeKeyDown
            aria-labelledby="onboarding-title"
            PaperProps={{
                sx: {
                    borderRadius: isMobile ? 0 : 3,
                    maxWidth: isMobile ? '100%' : 560,
                    m: isMobile ? 0 : 2,
                    display: 'flex',
                    flexDirection: 'column',
                    // Ensure full height on mobile
                    ...(isMobile && { height: '100dvh' }),
                },
            }}
        >
            {/* ── Header: title + stepper ── */}
            <Box
                sx={{
                    px: { xs: 2.5, sm: 4 },
                    pt: { xs: 3, sm: 4 },
                    pb: 2,
                    flexShrink: 0,
                }}
            >
                <Typography
                    id="onboarding-title"
                    variant="h6"
                    fontWeight={700}
                    gutterBottom
                    ref={stepHeadingRef}
                    tabIndex={-1}
                    sx={{ outline: 'none' }}
                >
                    {STEP_TITLE[activeStep]}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    {STEP_SUBTITLE[activeStep]}
                </Typography>
                <Stepper activeStep={activeStep} alternativeLabel>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: 12 } }}>
                                {label}
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </Box>

            {/* ── Scrollable step content ── */}
            <DialogContent
                dividers
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    px: { xs: 2.5, sm: 4 },
                    py: 2,
                }}
            >
                {activeStep === 0 && (
                    <InterestStep selected={selectedInterests} onToggle={toggleInterest} />
                )}
                {activeStep === 1 && (
                    <SuggestedStep
                        users={searchQuery.trim() ? searchResults : suggestedUsers}
                        loading={suggestedLoading || (searchLoading && searchQuery.trim() !== '')}
                        error={suggestedError}
                        onRetry={() => {
                            setSuggestedError(null);
                            // re-trigger fetch by bumping a counter
                            setSuggestedLoading(true);
                            getSuggestedUsers(20)
                                .then((d) => setSuggestedUsers(d.users || []))
                                .catch((e) => setSuggestedError(e.message))
                                .finally(() => setSuggestedLoading(false));
                        }}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        toggleFollow={toggleFollow}
                        isFollowByMe={isFollowByMe}
                    />
                )}
                {activeStep === 2 && (
                    <ProfileStep
                        values={profileValues}
                        onChange={(k, v) => setProfileValues((p) => ({ ...p, [k]: v }))}
                        error={profileError}
                    />
                )}
            </DialogContent>

            {/* ── Action bar — sticky on mobile ── */}
            <Box
                sx={{
                    px: { xs: 2.5, sm: 4 },
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    flexShrink: 0,
                }}
            >
                {/* Skip is always on the left */}
                <Button
                    onClick={handleSkip}
                    disabled={saving}
                    color="inherit"
                    sx={{ minHeight: 44, textTransform: 'none' }}
                >
                    Skip all
                </Button>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    {activeStep > 0 && (
                        <Button
                            variant="outlined"
                            onClick={handleBack}
                            disabled={saving}
                            sx={{ minHeight: 44, textTransform: 'none' }}
                        >
                            Back
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={saving}
                        sx={{ minHeight: 44, minWidth: 100, textTransform: 'none' }}
                    >
                        {saving
                            ? <CircularProgress size={18} color="inherit" />
                            : isLastStep ? 'Done' : 'Next'}
                    </Button>
                </Box>
            </Box>
        </Dialog>
    );
}

// ─── Step 1: Interests ─────────────────────────────────────────────────────────
function InterestStep({ selected, onToggle }) {
    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {CARD_CATEGORIES.map((cat) => {
                const isSelected = selected.includes(cat);
                return (
                    <Chip
                        key={cat}
                        label={cat}
                        onClick={() => onToggle(cat)}
                        color={isSelected ? 'primary' : 'default'}
                        variant={isSelected ? 'filled' : 'outlined'}
                        aria-pressed={isSelected}
                        sx={{
                            cursor: 'pointer',
                            transition: REDUCED_MOTION ? 'none' : 'background 150ms, color 150ms',
                        }}
                    />
                );
            })}
        </Box>
    );
}

// ─── Step 2: Suggested People ──────────────────────────────────────────────────
function SuggestedStep({ users, loading, error, onRetry, searchQuery, onSearchChange, toggleFollow, isFollowByMe }) {
    if (error) {
        return (
            <Box textAlign="center" py={4}>
                <Typography color="error" gutterBottom>{error}</Typography>
                <Button onClick={onRetry} variant="outlined" sx={{ minHeight: 44 }}>
                    Retry
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            <TextField
                fullWidth
                size="small"
                placeholder="Search people…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    ),
                }}
                sx={{ mb: 2 }}
            />

            {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Skeleton variant="circular" width={44} height={44} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton width="60%" />
                            <Skeleton width="40%" />
                        </Box>
                        <Skeleton variant="rectangular" width={90} height={36} sx={{ borderRadius: 1 }} />
                    </Box>
                ))
            ) : users.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={4}>
                    {searchQuery.trim() ? 'No users found.' : 'No suggestions yet — follow some people from your network!'}
                </Typography>
            ) : (
                users.map((u) => (
                    <UserRow
                        key={u._id}
                        user={u}
                        isFollowing={isFollowByMe(u._id) || !!u.isFollowing}
                        onFollow={() => toggleFollow(u._id)}
                    />
                ))
            )}
        </Box>
    );
}

// ─── User row (reusable within wizard) ────────────────────────────────────────
function UserRow({ user: u, isFollowing, onFollow }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 2,
                width: '100%',
            }}
        >
            <Avatar
                src={u.profilePicture}
                sx={{ width: 44, height: 44, flexShrink: 0 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={600} fontSize={14} noWrap>
                    {u.name} {u.lastName}
                </Typography>
                {u.job && (
                    <Typography fontSize={12} color="text.secondary" noWrap>
                        {u.job}
                    </Typography>
                )}
                {u.followersCount != null && (
                    <Typography fontSize={11} color="text.disabled">
                        {u.followersCount.toLocaleString()} followers
                    </Typography>
                )}
            </Box>
            <Button
                size="small"
                variant={isFollowing ? 'outlined' : 'contained'}
                startIcon={isFollowing ? <CheckIcon /> : <PersonAddIcon />}
                onClick={onFollow}
                sx={{
                    minHeight: 44,
                    textTransform: 'none',
                    flexShrink: 0,
                    transition: REDUCED_MOTION ? 'none' : undefined,
                }}
            >
                {isFollowing ? 'Following' : 'Follow'}
            </Button>
        </Box>
    );
}

// ─── Step 3: Finish Profile ────────────────────────────────────────────────────
// Only shown to Google-login users (form-registered users already provided
// this data). Uses the same built-in select components as RegisteredPage and
// ProfileSection to ensure consistent UX and valid values.
function ProfileStep({ values, onChange, error }) {
    const { apiCountriesList } = useCountries();
    const { cities, isCitiesLoading } = useCities(values.country || '');

    const handleCountryChange = (e) => {
        onChange('country', e.target.value);
        onChange('city', ''); // reset city when country changes
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
                label="Job / Industry"
                select
                size="small"
                fullWidth
                value={values.job || ''}
                onChange={(e) => onChange('job', e.target.value)}
            >
                {JOB_INDUSTRIES.map((job) => (
                    <MenuItem key={job} value={job}>{job}</MenuItem>
                ))}
            </TextField>
            <TextField
                label="Phone"
                size="small"
                fullWidth
                value={values.phone || ''}
                onChange={(e) => onChange('phone', e.target.value)}
                inputProps={{ inputMode: 'tel' }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                    label="Country"
                    select
                    size="small"
                    fullWidth
                    value={values.country || ''}
                    onChange={handleCountryChange}
                >
                    {apiCountriesList.map((country) => (
                        <MenuItem key={country.code} value={country.name}>
                            {country.name}
                        </MenuItem>
                    ))}
                </TextField>
                <Autocomplete
                    fullWidth
                    options={cities}
                    value={values.city || null}
                    onChange={(e, newValue) => onChange('city', newValue || '')}
                    disabled={!values.country}
                    loading={isCitiesLoading}
                    renderInput={(params) => (
                        <TextField {...params} size="small" label="City" />
                    )}
                />
            </Box>
            <TextField
                label="Gender"
                select
                size="small"
                fullWidth
                value={values.gender || ''}
                onChange={(e) => onChange('gender', e.target.value)}
            >
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
            </TextField>
            <TextField
                label="About me"
                size="small"
                fullWidth
                multiline
                rows={3}
                value={values.aboutMe || ''}
                onChange={(e) => onChange('aboutMe', e.target.value)}
                inputProps={{ maxLength: 500 }}
            />
            {error && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );
}
