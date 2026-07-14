import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithRouter } from './test-utils/render-with-router';

// Regression test for: the logged-in user should NOT appear in the all-users
// list, and there should be NO Follow button on your own card. The fix excludes
// self at the page level (UsersPage) and guards the Follow button on the card
// (UserReusableCard) — the provider's full users array is intentionally left
// untouched (it backs follower counts + the own-profile route).

const ME = '6a000000000000000000me00';
const OTHER = '6a000000000000000000ot00';

const mkUser = (id, name) => ({
    _id: id,
    name,
    lastName: 'Tester',
    job: 'Builder',
    aboutMe: 'Some words about this person that are long enough to slice.',
    gender: 'Male',
    age: 30,
    coverImage: '',
    profilePicture: '',
    following: [],
    address: { country: 'Wonderland', city: 'Capital' },
});

const meUser = mkUser(ME, 'Mememe');
const otherUser = mkUser(OTHER, 'Otherother');

vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: ME }, isLoggedIn: true }),
}));
vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({ users: [meUser, otherUser], loading: false }),
}));
vi.mock('../src/providers/CardsProvider', () => ({
    useCardsProvider: () => ({ registeredCards: [] }),
}));
vi.mock('../src/hooks/useSelectedUsers', () => ({
    default: () => ({ selectedUsers: [], selectHandleUser: vi.fn(), handleRemoveUser: vi.fn() }),
}));
// The card reads these; isFollowByMe(self) is false, so an unguarded button
// would render "Follow" on the own card — which is exactly what we assert against.
vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({
        isFollowByMe: () => false,
        getFollowersCount: () => 0,
        getFollowingCount: () => 0,
        toggleFollow: vi.fn(),
    }),
}));
// UsersPage now fetches its list server-side (getUsersSearch) instead of filtering
// the provider array. Mock the two endpoints (resolved values set per-test, since
// the factory is hoisted above the fixture consts). The page still excludes self
// client-side (displayUsers), which is what this regression guards.
vi.mock('../src/services/apiService', async (importOriginal) => ({
    ...(await importOriginal()),
    getUsersSearch: vi.fn(),
    getUserCountries: vi.fn(),
}));

import UsersPage from '../src/pages/UsersPage';
import UserReusableCard from '../src/components/UserReusableCard';
import { getUsersSearch, getUserCountries } from '../src/services/apiService';

afterEach(() => cleanup());

describe('UsersPage — excludes the logged-in user', () => {
    it('does not render the current user in the all-users grid', async () => {
        getUsersSearch.mockResolvedValue({ items: [meUser, otherUser], nextCursor: null });
        getUserCountries.mockResolvedValue({ countries: [] });
        renderWithRouter(<UsersPage />);
        expect(await screen.findByText('Otherother Tester')).toBeInTheDocument();
        expect(screen.queryByText('Mememe Tester')).not.toBeInTheDocument();
    });

    it('the results count reflects self being excluded (1, not 2)', async () => {
        getUsersSearch.mockResolvedValue({ items: [meUser, otherUser], nextCursor: null });
        getUserCountries.mockResolvedValue({ countries: [] });
        renderWithRouter(<UsersPage />);
        expect(await screen.findByText(/^\s*1 Results/)).toBeInTheDocument();
    });
});

describe('UserReusableCard — Follow button self-guard', () => {
    it('renders NO Follow button on your own card', () => {
        renderWithRouter(<UserReusableCard userObject={meUser} postsCount={0} />);
        expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument();
    });

    it("renders a Follow button on another user's card", () => {
        renderWithRouter(<UserReusableCard userObject={otherUser} postsCount={0} />);
        expect(screen.getByRole('button', { name: /follow/i })).toBeInTheDocument();
    });
});
