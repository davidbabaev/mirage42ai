/**
 * ReportPost.test.jsx
 *
 * Tests for the report-a-post UI:
 *   - Opening the ⋯ menu on another user's post shows "Report post"
 *   - Report post: picking a reason + submitting calls reportCard with the right args
 *   - Dialog auto-closes on success; success toast appears
 *   - alreadyReported: toast says "already reported"
 *   - Own post: ⋯ menu is NOT rendered
 *   - Error: shows inline error message, dialog stays open
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---- mocks ----------------------------------------------------------------

const ME = 'me-id';
const OTHER = 'other-id';

vi.mock('../src/providers/authContext', () => ({
    useAuth: () => ({ user: { _id: ME }, isLoggedIn: true }),
}));

vi.mock('../src/providers/usersContext', () => ({
    useUsersProvider: () => ({
        users: [
            { _id: ME, name: 'Me', lastName: 'User', job: 'Self', profilePicture: '' },
            { _id: OTHER, name: 'Alice', lastName: 'Smith', job: 'Dev', profilePicture: '' },
        ],
    }),
}));

vi.mock('../src/hooks/useLikedCards', () => ({
    default: () => ({
        toggleLike: vi.fn(),
        isLikeByMe: () => false,
        getLikeCount: () => 0,
    }),
}));

vi.mock('../src/hooks/useCommentsCards', () => ({
    default: () => ({
        addComment: vi.fn(),
        countComments: () => 0,
        removeComment: vi.fn(),
    }),
}));

vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({
        toggleFollow: vi.fn(),
        isFollowByMe: () => false,
        getFollowersCount: () => 10,
    }),
}));

const reportCardMock = vi.fn();
vi.mock('../src/services/apiService', () => ({
    reportCard: (...args) => reportCardMock(...args),
    getRecentContacts: vi.fn().mockResolvedValue([]),
    searchUsers: vi.fn().mockResolvedValue([]),
}));

// ---- import component AFTER mocks -----------------------------------------
import CardItem from '../src/components/CardItem';

// ---- helpers ---------------------------------------------------------------

const makeCard = (overrides = {}) => ({
    _id: 'card-1',
    userId: OTHER,
    title: 'Test post',
    content: 'Some content',
    mediaUrl: '',
    mediaType: 'image',
    likes: [],
    comments: [],
    createdAt: new Date().toISOString(),
    ...overrides,
});

const defaultProps = {
    onOpenCard: vi.fn(),
    openCommentCardId: null,
    setOpenCommentCardId: vi.fn(),
    onSaveCard: vi.fn(),
    isSavedCard: false,
    onRemoveSavedCard: vi.fn(),
};

function renderCard(card = makeCard()) {
    return render(
        <MemoryRouter>
            <CardItem card={card} {...defaultProps} />
        </MemoryRouter>
    );
}

// ---- tests ----------------------------------------------------------------

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('Report-a-post: overflow menu', () => {
    it('shows ⋯ Post options button on another user\'s post', () => {
        renderCard();
        expect(screen.getByRole('button', { name: /post options/i })).toBeInTheDocument();
    });

    it('does NOT show ⋯ Post options on own post', () => {
        renderCard(makeCard({ userId: ME }));
        expect(screen.queryByRole('button', { name: /post options/i })).not.toBeInTheDocument();
    });

    it('clicking ⋯ opens a menu with "Report post"', () => {
        renderCard();
        fireEvent.click(screen.getByRole('button', { name: /post options/i }));
        expect(screen.getByRole('menuitem', { name: /report post/i })).toBeInTheDocument();
    });
});

describe('Report-a-post: dialog flow', () => {
    beforeEach(() => {
        renderCard();
        // Open menu then click "Report post"
        fireEvent.click(screen.getByRole('button', { name: /post options/i }));
        fireEvent.click(screen.getByRole('menuitem', { name: /report post/i }));
    });

    it('opens the report dialog with a reason radio group', () => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // At least one radio option is visible (the fieldset/radiogroup contains the radios)
        expect(screen.getByRole('radio', { name: /spam/i })).toBeInTheDocument();
    });

    it('Submit is disabled until a reason is selected', () => {
        const submit = screen.getByRole('button', { name: /submit/i });
        expect(submit).toBeDisabled();
    });

    it('Submit enables after selecting a reason', () => {
        fireEvent.click(screen.getByRole('radio', { name: /spam/i }));
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
    });

    it('submitting calls reportCard with the correct cardId and reason', async () => {
        reportCardMock.mockResolvedValueOnce({ alreadyReported: false });

        fireEvent.click(screen.getByRole('radio', { name: /spam/i }));
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => {
            expect(reportCardMock).toHaveBeenCalledWith('card-1', 'spam');
        });
    });

    it('dialog closes on success and success toast appears', async () => {
        reportCardMock.mockResolvedValueOnce({ alreadyReported: false });

        fireEvent.click(screen.getByRole('radio', { name: /harassment/i }));
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        // Toast message visible
        expect(screen.getByText(/thanks for your report/i)).toBeInTheDocument();
    });

    it('shows "already reported" toast when API returns alreadyReported', async () => {
        reportCardMock.mockResolvedValueOnce({ alreadyReported: true });

        fireEvent.click(screen.getByRole('radio', { name: /spam/i }));
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(screen.getByText(/already reported/i)).toBeInTheDocument();
    });

    it('shows inline error and keeps dialog open on API failure', async () => {
        reportCardMock.mockRejectedValueOnce(new Error('Network error'));

        fireEvent.click(screen.getByRole('radio', { name: /other/i }));
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => {
            expect(screen.getByText(/network error/i)).toBeInTheDocument();
        });
        // Dialog should still be open
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('Cancel closes the dialog without calling reportCard', () => {
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(reportCardMock).not.toHaveBeenCalled();
    });
});

describe('Report-a-post: already-reported state', () => {
    it('menu item shows "Reported" and is disabled after a successful report', async () => {
        reportCardMock.mockResolvedValueOnce({ alreadyReported: false });
        renderCard();

        // Open menu → report
        fireEvent.click(screen.getByRole('button', { name: /post options/i }));
        fireEvent.click(screen.getByRole('menuitem', { name: /report post/i }));

        fireEvent.click(screen.getByRole('radio', { name: /spam/i }));
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        // Wait for dialog to close
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        // Re-open menu
        fireEvent.click(screen.getByRole('button', { name: /post options/i }));
        const reportedItem = screen.getByRole('menuitem', { name: /reported/i });
        expect(reportedItem).toBeInTheDocument();
        expect(reportedItem).toHaveAttribute('aria-disabled', 'true');
    });
});
