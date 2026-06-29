import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------- mock react-router-dom navigate --------------------------------
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
    ...(await orig()),
    useNavigate: () => navigate,
}));

// ---------- mock useFollowUser -------------------------------------------
const toggleFollow = vi.fn(() => Promise.resolve());
const isFollowByMe = vi.fn(() => false);
const getFollowersCount = vi.fn(() => 42);
vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({ toggleFollow, isFollowByMe, getFollowersCount }),
}));

// ---------- mock getCardLikes --------------------------------------------
const getCardLikesMock = vi.fn();
vi.mock('../src/services/apiService', () => ({
    getCardLikes: (...args) => getCardLikesMock(...args),
}));

// ---------- mock useLikedCards / useCommentsCards / useFollowUser / etc --
// (CardItem pulls many providers; we mock them all to keep tests isolated)
vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true }),
}));
vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({ users: [] }),
}));
vi.mock('../src/hooks/useLikedCards', () => ({
    default: () => ({
        toggleLike: vi.fn(),
        isLikeByMe: (id) => id === 'card1',
        getLikeCount: (id) => (id === 'card1' ? 3 : 0),
    }),
}));
vi.mock('../src/hooks/useCommentsCards', () => ({
    default: () => ({ addComment: vi.fn(), countComments: () => 0, removeComment: vi.fn() }),
}));
vi.mock('../src/hooks/useFavoriteCards', () => ({
    default: () => ({ favoriteCards: [], handleFavoriteCards: vi.fn() }),
}));
vi.mock('../src/providers/CardsProvider', () => ({
    useCardsProvider: () => ({ registeredCards: [] }),
}));

import LikesModal from '../src/components/LikesModal';
import CardItem from '../src/components/CardItem';

// ---------------------------------------------------------------------------

const makeUsers = (n) =>
    Array.from({ length: n }, (_, i) => ({
        _id: `u${i}`,
        name: `Alice${i}`,
        lastName: 'Doe',
        job: 'Engineer',
        profilePicture: '',
    }));

const renderLikesModal = (props = {}) =>
    render(
        <MemoryRouter>
            <LikesModal
                open
                onClose={() => {}}
                cardId='card1'
                likeCount={5}
                {...props}
            />
        </MemoryRouter>
    );

// ---------------------------------------------------------------------------

beforeEach(() => {
    navigate.mockClear();
    toggleFollow.mockClear();
    getCardLikesMock.mockClear();
    isFollowByMe.mockReturnValue(false);
});

afterEach(() => cleanup());

// ---------------------------------------------------------------------------

describe('LikesModal', () => {
    it('shows loading skeletons while fetching', async () => {
        // Never resolve so we stay in loading state.
        getCardLikesMock.mockReturnValue(new Promise(() => {}));
        renderLikesModal();
        // Skeletons render as plain elements — check for dialog title presence
        // and that no user rows are shown yet.
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByText('Alice0 Doe')).not.toBeInTheDocument();
    });

    it('renders fetched likers after load', async () => {
        getCardLikesMock.mockResolvedValue({ users: makeUsers(3), nextCursor: null });
        renderLikesModal({ likeCount: 3 });
        await waitFor(() => expect(screen.getByText('Alice0 Doe')).toBeInTheDocument());
        expect(screen.getByText('Alice1 Doe')).toBeInTheDocument();
        expect(screen.getByText('Alice2 Doe')).toBeInTheDocument();
    });

    it('shows title with like count', async () => {
        getCardLikesMock.mockResolvedValue({ users: [], nextCursor: null });
        renderLikesModal({ likeCount: 7 });
        expect(screen.getByText('7 Likes')).toBeInTheDocument();
    });

    it('shows empty state when no likers', async () => {
        getCardLikesMock.mockResolvedValue({ users: [], nextCursor: null });
        renderLikesModal({ likeCount: 0 });
        await waitFor(() => expect(screen.getByText('No likes yet.')).toBeInTheDocument());
    });

    it('shows error state when fetch fails', async () => {
        getCardLikesMock.mockRejectedValue(new Error('Network error'));
        renderLikesModal();
        await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
    });

    it('calls toggleFollow when Follow button is clicked', async () => {
        getCardLikesMock.mockResolvedValue({ users: makeUsers(1), nextCursor: null });
        renderLikesModal();
        await waitFor(() => expect(screen.getByText('Alice0 Doe')).toBeInTheDocument());
        const followBtn = screen.getByRole('button', { name: /follow alice0/i });
        await act(async () => { fireEvent.click(followBtn); });
        expect(toggleFollow).toHaveBeenCalledWith('u0');
    });

    it('shows Following text when already following', async () => {
        isFollowByMe.mockReturnValue(true);
        getCardLikesMock.mockResolvedValue({ users: makeUsers(1), nextCursor: null });
        renderLikesModal();
        await waitFor(() => expect(screen.getByText('Following')).toBeInTheDocument());
    });

    it('calls onClose when close button is clicked', async () => {
        getCardLikesMock.mockResolvedValue({ users: [], nextCursor: null });
        const onClose = vi.fn();
        render(
            <MemoryRouter>
                <LikesModal open onClose={onClose} cardId='card1' likeCount={0} />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------

describe('CardItem — likes count clickability', () => {
    const baseCard = {
        _id: 'card1',
        userId: 'u0',
        title: 'Test post',
        content: 'Hello',
        likes: ['u1', 'u2', 'u3'],
        comments: [],
        createdAt: new Date().toISOString(),
        mediaUrl: null,
        mediaType: null,
    };

    it('renders a button for the likes cluster when likes > 0', () => {
        getCardLikesMock.mockResolvedValue({ users: [], nextCursor: null });
        render(
            <MemoryRouter>
                <CardItem
                    card={baseCard}
                    onOpenCard={() => {}}
                    openCommentCardId={null}
                    setOpenCommentCardId={() => {}}
                    onSaveCard={() => {}}
                    isSavedCard={false}
                    onRemoveSavedCard={() => {}}
                />
            </MemoryRouter>
        );
        // getLikeCount('card1') returns 3 via our mock
        const likesBtn = screen.getByRole('button', { name: /view 3 likes/i });
        expect(likesBtn).toBeInTheDocument();
    });

    it('clicking the likes count opens LikesModal', async () => {
        getCardLikesMock.mockResolvedValue({ users: [], nextCursor: null });
        render(
            <MemoryRouter>
                <CardItem
                    card={baseCard}
                    onOpenCard={() => {}}
                    openCommentCardId={null}
                    setOpenCommentCardId={() => {}}
                    onSaveCard={() => {}}
                    isSavedCard={false}
                    onRemoveSavedCard={() => {}}
                />
            </MemoryRouter>
        );
        const likesBtn = screen.getByRole('button', { name: /view 3 likes/i });
        fireEvent.click(likesBtn);
        await waitFor(() =>
            expect(screen.getByRole('dialog')).toBeInTheDocument()
        );
    });

    it('does NOT render a likes button when likes count is 0', () => {
        const zeroCard = { ...baseCard, _id: 'card2', likes: [] };
        render(
            <MemoryRouter>
                <CardItem
                    card={zeroCard}
                    onOpenCard={() => {}}
                    openCommentCardId={null}
                    setOpenCommentCardId={() => {}}
                    onSaveCard={() => {}}
                    isSavedCard={false}
                    onRemoveSavedCard={() => {}}
                />
            </MemoryRouter>
        );
        // getLikeCount('card2') returns 0 via our mock — no button
        expect(screen.queryByRole('button', { name: /view.*likes/i })).not.toBeInTheDocument();
        expect(screen.getByText('No likes yet')).toBeInTheDocument();
    });
});
