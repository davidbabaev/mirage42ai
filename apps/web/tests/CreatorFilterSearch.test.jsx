import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The creator filter on /allcards used to filter the FULLY-LOADED users array
// client-side. At 100k+ users that cannot work, and it depends on the global load
// being retired. It must query the server instead.

vi.mock('../src/services/apiService', () => ({
    searchUsers: vi.fn().mockResolvedValue({ items: [] }),
    getUsersBrowse: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getCardsSearch: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
}));
vi.mock('../src/providers/authContext', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true }),
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

import AllCardsPage from '../src/pages/AllCardsPage';
import { searchUsers, getUsersBrowse, getCardsSearch } from '../src/services/apiService';

const renderPage = () => render(<MemoryRouter><AllCardsPage /></MemoryRouter>);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('creator filter searches the server', () => {
    // The regression this guards: the picker used to call searchUsers('') on mount.
    // An EMPTY term makes the server skip its limit and return the ENTIRE users
    // collection — reintroducing the exact load-everything call this epic removed.
    // A browser network trace caught it; no mocked test could.
    it('does NOT reach for the unbounded user list when the box is empty', async () => {
        renderPage();

        await waitFor(() => expect(getUsersBrowse).toHaveBeenCalled());
        // The default list is a BOUNDED page...
        expect(getUsersBrowse).toHaveBeenCalledWith(undefined, 10);
        // ...and the search endpoint is never called with an empty term.
        for (const call of searchUsers.mock.calls) {
            expect(String(call[0] ?? '').trim()).not.toBe('');
        }
    });

    it('queries the server as you type, instead of filtering a loaded users array', async () => {
        searchUsers.mockResolvedValue({
            items: [{ _id: 'u1', name: 'Ada', lastName: 'Lovelace', profilePicture: '' }],
        });

        renderPage();
        await waitFor(() => expect(getUsersBrowse).toHaveBeenCalled());

        const input = screen.getByPlaceholderText('Search people..');
        fireEvent.change(input, { target: { value: 'Ada' } });

        // Debounced, so it lands slightly later.
        await waitFor(() => expect(searchUsers).toHaveBeenCalledWith('Ada', 10), { timeout: 2000 });
        expect(await screen.findByText(/Ada/)).toBeInTheDocument();
    });

    it('selecting a creator drives the server-side card query', async () => {
        // The default (empty-box) list comes from the bounded browse page.
        getUsersBrowse.mockResolvedValue({
            items: [{ _id: 'u1', name: 'Ada', lastName: 'Lovelace', profilePicture: '' }],
            nextCursor: null,
        });

        renderPage();
        const person = await screen.findByText(/Ada/);

        fireEvent.click(person);

        // The posts list is filtered by the server on creatorId — not client-side.
        await waitFor(() => {
            const called = getCardsSearch.mock.calls.some(
                args => JSON.stringify(args).includes('u1')
            );
            expect(called).toBe(true);
        });
    });
});
