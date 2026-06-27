import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The post composer ("Start a post...") appears on the PROFILE tab ONLY when
// you are viewing your OWN profile, never on someone else's. The actual posting
// flow reuses the feed's CreateCardTrigger -> CreateCardModal and is
// browser-verified; here we assert the own-profile gate.

const ME = '6a000000000000000000me00';
const OTHER = '6a000000000000000000ot00';

const mkUser = (id, name) => ({
    _id: id,
    name,
    lastName: 'Tester',
    job: 'Builder',
    aboutMe: 'Some words about this person.',
    gender: 'Male',
    age: 30,
    coverImage: '',
    profilePicture: '',
    following: [],
    address: { country: 'Wonderland', city: 'Capital' },
    createdAt: '2026-01-01T00:00:00.000Z',
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
    useCardsProvider: () => ({ registeredCards: [], handleCardRegister: vi.fn() }),
}));
vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({
        isFollowByMe: () => false,
        getFollowersCount: () => 0,
        toggleFollow: vi.fn(),
    }),
}));
vi.mock('../src/hooks/useFavoriteCards', () => ({
    default: () => ({
        favoriteCards: [],
        handleFavoriteCards: vi.fn(),
        handleRemoveCard: vi.fn(),
    }),
}));

import UserProfileMain from '../src/pages/userProfilePublicLayout/UserProfileMain';

const renderProfile = (id) =>
    render(
        <MemoryRouter initialEntries={[`/profiledashboard/${id}/profilemain`]}>
            <Routes>
                <Route path="/profiledashboard/:id/*" element={<UserProfileMain />} />
            </Routes>
        </MemoryRouter>
    );

afterEach(() => cleanup());

describe('Add-post composer on profile', () => {
    it('shows the composer on your OWN profile', () => {
        renderProfile(ME);
        expect(screen.getByText('Start a post...')).toBeInTheDocument();
    });

    it("does NOT show the composer on someone else's profile", () => {
        renderProfile(OTHER);
        expect(screen.queryByText('Start a post...')).not.toBeInTheDocument();
    });
});
