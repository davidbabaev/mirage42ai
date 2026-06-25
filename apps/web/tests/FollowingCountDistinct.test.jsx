import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import { renderWithRouter } from './test-utils/render-with-router';

// Regression test for the inflated "Following" count: the count is rendered
// distinct-safe (new Set(following).size), so a corrupt array carrying duplicate
// ids can never read as inflated. Here a following array of length 4 that only
// holds 2 DISTINCT ids must render as 2, not 4.

const ME = '6a000000000000000000me00';

const userWithDupes = {
    _id: '6a0000000000000000dup00',
    name: 'Dupe',
    lastName: 'Tester',
    job: 'Builder',
    aboutMe: 'Some words about this person that are long enough to slice nicely.',
    gender: 'Male',
    age: 30,
    coverImage: '',
    profilePicture: '',
    // 4 entries, 2 distinct — a naive .length would show 4.
    following: ['aaa111', 'aaa111', 'aaa111', 'bbb222'],
    address: { country: 'Wonderland', city: 'Capital' },
};

vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: ME }, isLoggedIn: true }),
}));
vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({
        isFollowByMe: () => false,
        getFollowersCount: () => 0,
        getFollowingCount: () => 0,
        toggleFollow: vi.fn(),
    }),
}));

import UserReusableCard from '../src/components/UserReusableCard';

afterEach(() => cleanup());

describe('Following count renders distinct (no duplicate inflation)', () => {
    it('shows 2 (distinct ids) for a following array of length 4 with duplicates', () => {
        renderWithRouter(<UserReusableCard userObject={userWithDupes} postsCount={7} />);
        // The "following" stat box holds the number + the "following" label.
        const followingBox = screen.getByText('following').parentElement;
        expect(within(followingBox).getByText('2')).toBeInTheDocument();
        expect(within(followingBox).queryByText('4')).not.toBeInTheDocument();
    });
});
