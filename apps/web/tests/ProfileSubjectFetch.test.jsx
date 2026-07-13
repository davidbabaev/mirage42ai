import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The profile subject is fetched from the server (GET /users/:id) instead of being
// found in a fully-loaded users array. The two states that used to be impossible —
// and are now the whole point — are: a profile that does not resolve must show
// "unavailable" (not an endless skeleton), and a profile that does resolve must
// render with the global users array EMPTY.

const SUBJECT = '6a000000000000000000ot00';

const subjectUser = {
    _id: SUBJECT,
    name: 'Otherother',
    lastName: 'Tester',
    job: 'Builder',
    aboutMe: 'Some words.',
    gender: 'Male',
    age: 30,
    coverImage: '',
    profilePicture: '',
    following: [],
    followersCount: 3,
    followingCount: 2,
    postsCount: 7,
    address: { country: 'Wonderland', city: 'Capital' },
    createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('../src/services/apiService', () => ({
    getSingleUser: vi.fn(),
    getExploreCards: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getFollowers: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getFollowing: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getMutualFollowing: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
}));
vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true }),
}));
// The global users array is EMPTY — the state after the load-everything provider
// is retired. The profile must still render.
vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({ users: [], loading: false, getUsers: vi.fn() }),
}));
vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({ isFollowByMe: () => false, getFollowersCount: () => 0, toggleFollow: vi.fn() }),
}));
vi.mock('../src/hooks/useBlockUser', () => ({
    default: () => ({ toggleBlock: vi.fn(), isBlockedByMe: () => false }),
}));
vi.mock('../src/hooks/useSelectedUsers', () => ({
    default: () => ({ selectedUsers: [], selectHandleUser: vi.fn() }),
}));
vi.mock('../src/hooks/useFavoriteCards', () => ({
    default: () => ({ favoriteCards: [], handleFavoriteCards: vi.fn(), handleRemoveCard: vi.fn() }),
}));
vi.mock('../src/hooks/useLikedCards', () => ({
    default: () => ({ toggleLike: vi.fn(), isLikeByMe: () => false, getLikeCount: () => 0 }),
}));
vi.mock('../src/hooks/useCommentsCards', () => ({
    default: () => ({ addComment: vi.fn(), countComments: () => 0, removeComment: vi.fn() }),
}));
vi.mock('../src/providers/ChatDockProvider', () => ({
    useChatDock: () => ({ openDock: vi.fn() }),
}));

import UserProfileLayout from '../src/pages/userProfilePublicLayout/UserProfileLayout';
import { getSingleUser } from '../src/services/apiService';

const renderLayout = () =>
    render(
        <MemoryRouter initialEntries={[`/profiledashboard/${SUBJECT}/profilemain`]}>
            <Routes>
                <Route path="/profiledashboard/:id/*" element={<UserProfileLayout />} />
            </Routes>
        </MemoryRouter>
    );

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('profile subject is fetched from the server', () => {
    it('renders the profile with the global users array empty', async () => {
        getSingleUser.mockResolvedValue(subjectUser);

        renderLayout();

        await waitFor(() => expect(getSingleUser).toHaveBeenCalledWith(SUBJECT));
        // The name renders in the layout header AND in the profile tab below it.
        const names = await screen.findAllByText(/Otherother/);
        expect(names.length).toBeGreaterThan(0);
        // The server-authoritative counts render too (they used to be derived
        // from the global arrays).
        expect(screen.getAllByText('7').length).toBeGreaterThan(0);   // postsCount
    });

    it('shows "unavailable" — not an endless skeleton — when the profile 404s', async () => {
        // A blocked relationship (either direction) and a non-existent user both
        // 404 by design, and both land here.
        getSingleUser.mockRejectedValue(new Error('User not found'));

        renderLayout();

        expect(await screen.findByText('This account is unavailable')).toBeInTheDocument();
    });
});
