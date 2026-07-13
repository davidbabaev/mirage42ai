import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';

// Following someone must bump THEIR follower count everywhere it's shown, instantly.
// That used to work by scanning the global users array (syncUser patched my record
// into it, and the count was "how many loaded users follow this id"). With the array
// retired that scan returns 0, so the count is recorded in the USER OVERLAY instead.

const TARGET = { _id: 'target1', name: 'Ada', lastName: 'Lovelace', followersCount: 5 };

vi.mock('../src/services/apiService', () => ({
    getAllUsers: vi.fn().mockResolvedValue([]),   // the retired global load: EMPTY
    banUser: vi.fn(), deleteUser: vi.fn(), promoteUser: vi.fn(),
}));

// Follow returns MY updated record (with the target now in my `following`).
const handleToggleFollow = vi.fn(async () => ({ _id: 'me', following: ['target1'] }));
vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: 'me', following: [] }, isLoggedIn: true, handleToggleFollow }),
}));
vi.mock('../src/providers/CardsProvider', () => ({
    useCardsProvider: () => ({ addAuthorToFeed: vi.fn(), removeAuthorFromFeed: vi.fn() }),
}));

import { UsersProvider } from '../src/providers/UsersProvider';
import useFollowUser from '../src/hooks/useFollowUser';

function Harness() {
    const { toggleFollow, getFollowersCount } = useFollowUser();
    return (
        <div>
            <span data-testid="count">{getFollowersCount(TARGET)}</span>
            <button data-testid="follow" onClick={() => toggleFollow(TARGET)}>follow</button>
        </div>
    );
}

beforeEach(() => { localStorage.setItem('auth-token', 't'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe("follower count of the person you follow, with no global users array", () => {
    it("reads the server count, then bumps it on follow", async () => {
        render(<UsersProvider><Harness /></UsersProvider>);

        // Server-sent count on the user object — no array scan.
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('5'));

        await act(async () => { screen.getByTestId('follow').click(); });

        // +1, recorded in the overlay so every surface showing this user agrees.
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('6'));
    });

    it('unfollowing takes it back down', async () => {
        handleToggleFollow
            .mockResolvedValueOnce({ _id: 'me', following: ['target1'] })  // follow
            .mockResolvedValueOnce({ _id: 'me', following: [] });          // unfollow

        render(<UsersProvider><Harness /></UsersProvider>);
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('5'));

        await act(async () => { screen.getByTestId('follow').click(); });
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('6'));

        await act(async () => { screen.getByTestId('follow').click(); });
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('5'));
    });
});
