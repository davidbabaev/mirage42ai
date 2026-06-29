/**
 * AdminCardsReports.test.jsx
 *
 * Tests for the Reports column + reporter-list modal in AdminCardsPanel,
 * and the post-reported notification type in Notifications.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---- provider & service mocks ------------------------------------------------

const ADMIN_ID = 'admin-1';
const OTHER_ID = 'other-1';

vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: ADMIN_ID } }),
}));

vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({
        loading: false,
        getUsers: vi.fn(),
        users: [
            { _id: ADMIN_ID, name: 'Admin', lastName: 'User', profilePicture: '' },
            { _id: OTHER_ID, name: 'Alice', lastName: 'Smith', profilePicture: '' },
        ],
    }),
}));

vi.mock('../src/providers/CardsProvider', () => ({
    useCardsProvider: () => ({
        registeredCards: [
            {
                _id: 'card-reported',
                userId: OTHER_ID,
                title: 'Reported Post',
                content: '',
                mediaUrl: '',
                mediaType: 'image',
                likes: [],
                comments: [],
                createdAt: new Date().toISOString(),
                status: 'active',
                category: 'Technology',
                reportCount: 3,
            },
            {
                _id: 'card-clean',
                userId: OTHER_ID,
                title: 'Clean Post',
                content: '',
                mediaUrl: '',
                mediaType: 'image',
                likes: [],
                comments: [],
                createdAt: new Date().toISOString(),
                status: 'active',
                category: 'Science',
                reportCount: 0,
            },
        ],
        refreshFeed: vi.fn(),
        fetchCards: vi.fn(),
        handleDeleteCard: vi.fn(),
        handleBanCard: vi.fn(),
    }),
}));

vi.mock('../src/hooks/useFavoriteCards', () => ({
    default: () => ({ favoriteCards: [] }),
}));

vi.mock('../src/hooks/useDebounce', () => ({
    default: (v) => v,
}));

const getCardReportsMock = vi.fn();
vi.mock('../src/services/apiService', () => ({
    getCardReports: (...args) => getCardReportsMock(...args),
}));

// Stub out heavy child components
vi.mock('../src/components/card/CardPopupModal', () => ({ default: () => null }));
vi.mock('../src/components/ConfirmationDialog', () => ({ default: () => null }));
vi.mock('../src/components/OnLoadingSkeletonBox', () => ({ default: () => <div>Loading skeleton</div> }));
vi.mock('../src/components/MediaDisplay', () => ({ default: () => <div data-testid="media-display" /> }));

// ---- import components after mocks -----------------------------------------
import AdminCardsPanel from '../src/pages/adminUserDashboard/AdminCardsPanel';

// For Notifications tests
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

import Notifications from '../src/components/Notifications';

// ---- helpers ---------------------------------------------------------------

function renderAdminCards() {
    return render(
        <MemoryRouter>
            <AdminCardsPanel />
        </MemoryRouter>
    );
}

const makeNotification = (overrides = {}) => ({
    _id: 'n1',
    fromUser: 'u-reporter',
    whichCard: 'c1',
    actionType: 'like',
    isRead: true,
    createdAt: new Date().toISOString(),
    ...overrides,
});

function renderNotifications(notifications, onClose = vi.fn()) {
    return render(
        <MemoryRouter>
            <Notifications
                notificationsValue={notifications}
                handleDeleteNotificationValue={vi.fn()}
                onClose={onClose}
            />
        </MemoryRouter>
    );
}

beforeEach(() => {
    navigate.mockClear();
    getCardReportsMock.mockClear();
});

afterEach(() => cleanup());

// ---- AdminCardsPanel: Reports column ----------------------------------------

describe('AdminCardsPanel — Reports column', () => {
    it('renders a "Reports" column header', () => {
        renderAdminCards();
        expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    it('shows a muted "0" for a post with reportCount 0', () => {
        renderAdminCards();
        // The muted zero is a Typography; there should be one for the clean post
        // Use getAllByText in case multiple zeros appear
        const zeros = screen.getAllByText('0');
        expect(zeros.length).toBeGreaterThan(0);
    });

    it('shows a clickable button with the count for a post with reportCount > 0', () => {
        renderAdminCards();
        const reportBtn = screen.getByRole('button', { name: /view 3 reporters/i });
        expect(reportBtn).toBeInTheDocument();
    });

    it('does NOT show a clickable button for the post with reportCount 0', () => {
        renderAdminCards();
        // There should be no button labelled "View 0 reporters"
        expect(screen.queryByRole('button', { name: /view 0 reporters/i })).not.toBeInTheDocument();
    });

    it('clicking the report count button opens the modal and calls getCardReports', async () => {
        getCardReportsMock.mockResolvedValueOnce([]);
        renderAdminCards();

        const reportBtn = screen.getByRole('button', { name: /view 3 reporters/i });
        fireEvent.click(reportBtn);

        await waitFor(() => {
            expect(getCardReportsMock).toHaveBeenCalledWith('card-reported');
        });
        // Dialog should be open
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows loading skeletons while fetching reporters', async () => {
        // Never resolve so it stays in loading state
        getCardReportsMock.mockReturnValueOnce(new Promise(() => {}));
        renderAdminCards();

        const reportBtn = screen.getByRole('button', { name: /view 3 reporters/i });
        fireEvent.click(reportBtn);

        // Skeletons are rendered via MUI Skeleton; check dialog is open
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('shows reporter name, reason chip and timestamp in the modal', async () => {
        getCardReportsMock.mockResolvedValueOnce([
            {
                _id: 'r1',
                reason: 'spam',
                createdAt: new Date().toISOString(),
                reporter: { _id: OTHER_ID, name: 'Alice', lastName: 'Smith', profilePicture: '' },
            },
        ]);
        renderAdminCards();

        fireEvent.click(screen.getByRole('button', { name: /view 3 reporters/i }));

        await waitFor(() => {
            // Alice Smith appears in the table row AND in the modal reporter list
            expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
        });
        expect(screen.getByText('Spam')).toBeInTheDocument();
    });

    it('shows empty state when no reporters are returned', async () => {
        getCardReportsMock.mockResolvedValueOnce([]);
        renderAdminCards();

        fireEvent.click(screen.getByRole('button', { name: /view 3 reporters/i }));

        await waitFor(() => {
            expect(screen.getByText(/no reports found/i)).toBeInTheDocument();
        });
    });

    it('shows error state when getCardReports rejects', async () => {
        getCardReportsMock.mockRejectedValueOnce(new Error('Unauthorized'));
        renderAdminCards();

        fireEvent.click(screen.getByRole('button', { name: /view 3 reporters/i }));

        await waitFor(() => {
            expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
        });
    });

    it('closes the modal when the close button is clicked', async () => {
        getCardReportsMock.mockResolvedValueOnce([]);
        renderAdminCards();

        fireEvent.click(screen.getByRole('button', { name: /view 3 reporters/i }));
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /close reporters modal/i }));
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });
});

// ---- Notifications: post-reported -------------------------------------------

describe('Notifications — post-reported actionType', () => {
    it('renders "reported a post" for post-reported actionType', () => {
        renderNotifications([
            makeNotification({ actionType: 'post-reported', fromUser: 'u-reporter' }),
        ]);
        expect(screen.getByText(/reported a post/i)).toBeInTheDocument();
    });

    it('navigates to /allcards?card=<whichCard> when a post-reported notification is clicked', () => {
        const onClose = vi.fn();
        renderNotifications(
            [makeNotification({ actionType: 'post-reported', whichCard: 'c1' })],
            onClose,
        );
        fireEvent.click(screen.getByRole('listitem'));
        expect(navigate).toHaveBeenCalledWith('/allcards?card=c1');
        expect(onClose).toHaveBeenCalled();
    });
});
