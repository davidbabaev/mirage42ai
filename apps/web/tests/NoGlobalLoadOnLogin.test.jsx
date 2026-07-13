import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

// THE POINT OF THE WHOLE EPIC.
//
// UsersProvider used to call GET /users at app mount and CardsProvider GET /cards —
// every user in the database and every post in the database, downloaded on login,
// so the client could answer questions locally that the server should answer per
// request. Both are gone. Mounting the providers as a logged-in user must fire
// NEITHER.
//
// If someone reintroduces a global load, this test fails.

vi.mock('../src/services/apiService', () => ({
    getAllUsers: vi.fn().mockResolvedValue([]),
    getAllCards: vi.fn().mockResolvedValue([]),
    getFeedCards: vi.fn().mockResolvedValue({ cards: [], nextCursor: null }),
    // the rest are imported by the providers but not called on mount
    createCard: vi.fn(), deleteCard: vi.fn(), updateCard: vi.fn(),
    likeUnlikeCard: vi.fn(), addComment: vi.fn(), removeComment: vi.fn(),
    likeUnlikeComment: vi.fn(), addReply: vi.fn(), banCard: vi.fn(),
    getExploreCards: vi.fn(), banUser: vi.fn(), deleteUser: vi.fn(), promoteUser: vi.fn(),
}));
vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true }),
}));

import { UsersProvider } from '../src/providers/UsersProvider';
import { CardsProvider } from '../src/providers/CardsProvider';
import { getAllUsers, getAllCards, getFeedCards } from '../src/services/apiService';

beforeEach(() => { localStorage.setItem('auth-token', 'test-token'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('no load-everything request on login', () => {
    it('does NOT fetch every user in the database', async () => {
        render(<UsersProvider><div /></UsersProvider>);
        // Give any mount effect a chance to fire.
        await waitFor(() => expect(getAllUsers).not.toHaveBeenCalled());
        expect(getAllUsers).not.toHaveBeenCalled();
    });

    it('does NOT fetch every card in the database', async () => {
        render(<CardsProvider><div /></CardsProvider>);
        await waitFor(() => expect(getFeedCards).toHaveBeenCalled()); // the feed still loads...
        expect(getAllCards).not.toHaveBeenCalled();                   // ...but not the whole table
    });

    it('loads exactly ONE page of the feed, and nothing else', async () => {
        render(
            <UsersProvider>
                <CardsProvider><div /></CardsProvider>
            </UsersProvider>
        );

        await waitFor(() => expect(getFeedCards).toHaveBeenCalledTimes(1));
        expect(getAllUsers).not.toHaveBeenCalled();
        expect(getAllCards).not.toHaveBeenCalled();
    });
});
