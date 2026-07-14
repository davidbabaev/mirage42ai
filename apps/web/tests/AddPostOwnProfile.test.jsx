import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
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

vi.mock('../src/providers/authContext', () => ({
    useAuth: () => ({ user: { _id: ME }, isLoggedIn: true }),
}));
vi.mock('../src/providers/usersContext', () => ({
    useUsersProvider: () => ({ users: [meUser, otherUser], loading: false }),
}));
vi.mock('../src/providers/cardsContext', () => ({
    useCardsProvider: () => ({ registeredCards: [], handleCardRegister: vi.fn() }),
}));
// The profile post list is server-paginated now (it no longer filters the global
// cards array), so the page fetches its own posts on mount.
vi.mock('../src/services/apiService', () => ({
    getExploreCards: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    // Mutual connections + "people they follow that you don't" are server-side now.
    getMutualFollowing: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getFollowing: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
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
vi.mock('../src/hooks/useLikedCards', () => ({
    default: () => ({ toggleLike: vi.fn(), isLikeByMe: () => false, getLikeCount: () => 0 }),
}));
vi.mock('../src/hooks/useCommentsCards', () => ({
    default: () => ({ addComment: vi.fn(), countComments: () => 0, removeComment: vi.fn() }),
}));

import UserProfileMain from '../src/pages/userProfilePublicLayout/UserProfileMain';
import { getExploreCards } from '../src/services/apiService';
import { ProfileSubjectContext } from '../src/pages/userProfilePublicLayout/profileSubjectContext';

// The profile subject is resolved once by UserProfileLayout (server-side) and
// handed to the tabs through context — the tabs no longer look it up themselves.
const renderProfile = (id) => {
    const subject = [meUser, otherUser].find(u => u._id === id);
    return render(
        <MemoryRouter initialEntries={[`/profiledashboard/${id}/profilemain`]}>
            <ProfileSubjectContext.Provider value={subject}>
                <Routes>
                    <Route path="/profiledashboard/:id/*" element={<UserProfileMain />} />
                </Routes>
            </ProfileSubjectContext.Provider>
        </MemoryRouter>
    );
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

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

// The posts tab used to filter the global all-cards array. It now pages off the
// server, so it must work with that array EMPTY (the post-retirement state) and
// must ask for only THIS profile's posts.
describe('Profile posts come from the server, not the global cards array', () => {
    it("requests only this profile's posts", async () => {
        renderProfile(OTHER);
        await waitFor(() => expect(getExploreCards).toHaveBeenCalled());
        // (cursor, limit, userId) — page 1 has no cursor.
        expect(getExploreCards).toHaveBeenCalledWith(undefined, 10, OTHER);
    });

    it('renders posts returned by the server with registeredCards empty', async () => {
        getExploreCards.mockResolvedValueOnce({
            items: [{
                _id: 'c1',
                userId: OTHER,
                title: 'Server sourced post',
                content: 'from the endpoint',
                likes: [],
                comments: [],
                likePreview: [],
                createdAt: '2026-02-01T00:00:00.000Z',
                creator: { _id: OTHER, name: 'Otherother', lastName: 'Tester', profilePicture: '', job: 'Builder' },
            }],
            nextCursor: null,
        });

        renderProfile(OTHER);
        expect(await screen.findByText('from the endpoint')).toBeInTheDocument();
    });
});
