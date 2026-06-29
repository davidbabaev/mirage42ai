/**
 * OnboardingWizard tests
 *
 * Covers:
 * - Wizard renders when onboardingComplete is false
 * - Wizard does NOT render when onboardingComplete is true (or null)
 * - Step navigation (Next / Back)
 * - Skip calls updateOnboarding and marks complete
 * - Done on last step calls updateOnboarding and marks complete
 * - Step 3 (finish profile) is present only when isProfileIncomplete returns true
 * - Interest chip toggles
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Mock react-router-dom navigate ──────────────────────────────────────────
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
    ...(await orig()),
    useNavigate: () => navigate,
}));

// ─── Mock apiService ──────────────────────────────────────────────────────────
const mockGetSuggestedUsers = vi.fn(() => Promise.resolve({ users: [], nextCursor: null }));
const mockUpdateOnboarding   = vi.fn(() => Promise.resolve({ onboardingComplete: true, interests: [] }));
const mockSearchUsers        = vi.fn(() => Promise.resolve([]));

vi.mock('../src/services/apiService', async (orig) => ({
    ...(await orig()),
    getSuggestedUsers: (...args) => mockGetSuggestedUsers(...args),
    updateOnboarding:  (...args) => mockUpdateOnboarding(...args),
    searchUsers:       (...args) => mockSearchUsers(...args),
}));

// ─── Mock useFollowUser ───────────────────────────────────────────────────────
const toggleFollow  = vi.fn(() => Promise.resolve());
const isFollowByMe  = vi.fn(() => false);

vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({ toggleFollow, isFollowByMe, getFollowersCount: () => 0 }),
}));

// ─── Mock useDebounce (return value unchanged — avoids async timer juggling) ──
vi.mock('../src/hooks/useDebounce', () => ({
    default: (value) => value,
}));

// ─── Mock useAuth (user state injected per test) ───────────────────────────────
let mockUser = null;
const mockSetUser = vi.fn();
const mockEditUser = vi.fn(() => Promise.resolve({ success: true }));

vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({
        user:      mockUser,
        setUser:   mockSetUser,
        isLoggedIn: mockUser !== null,
        editUser:  mockEditUser,
    }),
    AuthProvider: ({ children }) => <>{children}</>,
}));

// ─── Mock hooks used by ProfileStep ──────────────────────────────────────────
vi.mock('../src/hooks/useCountries', () => ({
    default: () => ({ apiCountriesList: [{ code: 'US', name: 'United States' }], apiCountriesListLoading: '' }),
}));

vi.mock('../src/hooks/useCities', () => ({
    default: () => ({ cities: ['New York', 'Los Angeles'], isCitiesLoading: false }),
}));

// ─── Mock providers used by useFollowUser internally ─────────────────────────
vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({ users: [], syncUser: vi.fn() }),
    UsersProvider: ({ children }) => <>{children}</>,
}));

vi.mock('../src/providers/CardsProvider', () => ({
    useCardsProvider: () => ({
        feedCards: [],
        registeredCards: [],
        refreshFeed: vi.fn(),
        removeAuthorFromFeed: vi.fn(),
        addAuthorToFeed: vi.fn(),
    }),
    CardsProvider: ({ children }) => <>{children}</>,
}));

// ─── Target component ─────────────────────────────────────────────────────────
import OnboardingWizard from '../src/components/OnboardingWizard';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COMPLETE_USER = {
    _id: 'u1',
    name: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
    job: 'Engineer',
    phone: '555-1234',
    age: '28',
    gender: 'Female',
    birthDate: '1996-01-01',
    aboutMe: 'Hello',
    address: { country: 'US', city: 'New York' },
    following: [],
    onboardingComplete: false,
    interests: [],
};

const INCOMPLETE_USER = {
    ...COMPLETE_USER,
    job: 'Not Defined',
    gender: 'Unknown',
    aboutMe: 'Not Defined',
    address: { country: 'Not Defined', city: '' },
};

// A Google-login user that has an incomplete profile — the finish-profile step
// SHOULD appear for this user.
const GOOGLE_INCOMPLETE_USER = {
    ...INCOMPLETE_USER,
    googleId: 'google_oauth_123',
};

const renderWizard = () =>
    render(
        <MemoryRouter>
            <OnboardingWizard />
        </MemoryRouter>
    );

beforeEach(() => {
    mockUser = null;
    mockSetUser.mockClear();
    mockUpdateOnboarding.mockClear();
    mockEditUser.mockClear();
    toggleFollow.mockClear();
    isFollowByMe.mockClear();
    mockGetSuggestedUsers.mockClear();
});

afterEach(() => cleanup());

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('OnboardingWizard', () => {
    it('does NOT render when user is null (not logged in)', () => {
        mockUser = null;
        renderWizard();
        expect(screen.queryByText(/what are you into/i)).not.toBeInTheDocument();
    });

    it('does NOT render when onboardingComplete is true', () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: true };
        renderWizard();
        expect(screen.queryByText(/what are you into/i)).not.toBeInTheDocument();
    });

    it('renders step 1 when onboardingComplete is false', () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: false };
        renderWizard();
        expect(screen.getByText(/what are you into\?/i)).toBeInTheDocument();
        expect(screen.getByText('Pick Interests')).toBeInTheDocument();
    });

    it('toggles interest chip aria-pressed on click', () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: false };
        renderWizard();
        const chip = screen.getByRole('button', { name: /gaming/i });
        expect(chip).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(chip);
        expect(chip).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(chip);
        expect(chip).toHaveAttribute('aria-pressed', 'false');
    });

    it('navigates Next from step 1 to step 2', async () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: false };
        renderWizard();
        const nextBtn = screen.getByRole('button', { name: /next/i });
        await act(async () => { fireEvent.click(nextBtn); });
        expect(screen.getByText(/people to follow/i)).toBeInTheDocument();
    });

    it('navigates Back from step 2 to step 1', async () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: false };
        renderWizard();
        // advance to step 2
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); });
        expect(screen.getByText(/people to follow/i)).toBeInTheDocument();
        // back to step 1
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /back/i })); });
        expect(screen.getByText(/what are you into\?/i)).toBeInTheDocument();
    });

    it('Skip all calls updateOnboarding with onboardingComplete true', async () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: false };
        renderWizard();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /skip all/i })); });
        await waitFor(() =>
            expect(mockUpdateOnboarding).toHaveBeenCalledWith(
                expect.objectContaining({ onboardingComplete: true })
            )
        );
        expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ onboardingComplete: true }));
    });

    it('Done on last step (step 2 when profile complete) calls updateOnboarding', async () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: false };
        renderWizard();
        // step 1 → Next
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); });
        // step 2 → Done
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /done/i })); });
        await waitFor(() =>
            expect(mockUpdateOnboarding).toHaveBeenCalledWith(
                expect.objectContaining({ onboardingComplete: true })
            )
        );
    });

    it('passes selected interests to updateOnboarding', async () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: false };
        renderWizard();
        // select an interest
        fireEvent.click(screen.getByRole('button', { name: /gaming/i }));
        fireEvent.click(screen.getByRole('button', { name: /music/i }));
        // skip
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /skip all/i })); });
        await waitFor(() =>
            expect(mockUpdateOnboarding).toHaveBeenCalledWith(
                expect.objectContaining({ interests: expect.arrayContaining(['Gaming', 'Music']) })
            )
        );
    });

    // ── Step-gating: finish-profile is ONLY for Google-login users ────────────────

    it('shows finish-profile step (step 3) when user is a Google-login user with incomplete profile', async () => {
        mockUser = { ...GOOGLE_INCOMPLETE_USER, onboardingComplete: false };
        renderWizard();
        // Verify "Finish Profile" appears in stepper labels
        expect(screen.getByText('Finish Profile')).toBeInTheDocument();
        // Advance to step 3
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); }); // step 1→2
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); }); // step 2→3
        expect(screen.getByText(/finish your profile/i)).toBeInTheDocument();
    });

    it('does NOT show finish-profile step for a form-registered user even if profile is incomplete', () => {
        // INCOMPLETE_USER has no googleId — form-registered users already provided
        // this data at sign-up, so they must never see the finish-profile step.
        mockUser = { ...INCOMPLETE_USER, onboardingComplete: false };
        renderWizard();
        expect(screen.queryByText('Finish Profile')).not.toBeInTheDocument();
        // Only 2 steps visible in stepper
        expect(screen.getByText('Pick Interests')).toBeInTheDocument();
        expect(screen.getByText('Suggested People')).toBeInTheDocument();
    });

    it('does NOT show finish-profile step when profile is complete (even for Google user)', () => {
        mockUser = { ...COMPLETE_USER, googleId: 'google_oauth_123', onboardingComplete: false };
        renderWizard();
        expect(screen.queryByText('Finish Profile')).not.toBeInTheDocument();
    });

    it('does NOT show finish-profile step when profile is complete (form user)', () => {
        mockUser = { ...COMPLETE_USER, onboardingComplete: false };
        renderWizard();
        expect(screen.queryByText('Finish Profile')).not.toBeInTheDocument();
    });

    it('Done on step 2 for form user calls updateOnboarding but NOT editUser', async () => {
        // Form user (no googleId) has only 2 steps; Done on step 2 must complete
        // onboarding without calling editUser (profile was already collected at sign-up).
        mockUser = { ...INCOMPLETE_USER, onboardingComplete: false };
        renderWizard();
        // step 1 → Next
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); });
        // step 2 → Done (last step for 2-step path)
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /done/i })); });
        await waitFor(() =>
            expect(mockUpdateOnboarding).toHaveBeenCalledWith(
                expect.objectContaining({ onboardingComplete: true })
            )
        );
        expect(mockEditUser).not.toHaveBeenCalled();
    });

    it('Done on step 3 (Google user) calls editUser then updateOnboarding', async () => {
        mockUser = { ...GOOGLE_INCOMPLETE_USER, onboardingComplete: false };
        renderWizard();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); }); // →2
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); }); // →3
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /done/i })); });
        await waitFor(() => expect(mockEditUser).toHaveBeenCalled());
        await waitFor(() =>
            expect(mockUpdateOnboarding).toHaveBeenCalledWith(
                expect.objectContaining({ onboardingComplete: true })
            )
        );
    });
});
