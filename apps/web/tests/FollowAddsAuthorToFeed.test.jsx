import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';

// Following someone must surface their posts in the feed immediately — no full
// refetch, no scroll jump. That used to work by splicing their cards out of
// `registeredCards`, which held EVERY card in the app. With that global load
// retired the array is empty, so the posts must now come from the server.

vi.mock('../src/services/apiService', () => ({
    getAllCards: vi.fn().mockResolvedValue([]),        // the retired global load: empty
    getFeedCards: vi.fn().mockResolvedValue({ cards: [], nextCursor: null }),
    getExploreCards: vi.fn(),
    createCard: vi.fn(), deleteCard: vi.fn(), updateCard: vi.fn(),
    likeUnlikeCard: vi.fn(), addComment: vi.fn(), removeComment: vi.fn(),
    likeUnlikeComment: vi.fn(), addReply: vi.fn(), banCard: vi.fn(),
}));
vi.mock('../src/providers/authContext', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true, refreshMe: vi.fn() }),
}));

import { CardsProvider } from '../src/providers/CardsProvider';
import { useCardsProvider } from '../src/providers/cardsContext';
import { getExploreCards } from '../src/services/apiService';

const AUTHOR = 'author1';

function Harness() {
    const { feedCards, addAuthorToFeed } = useCardsProvider();
    return (
        <div>
            <span data-testid="count">{feedCards.length}</span>
            <ul>{feedCards.map(c => <li key={c._id}>{c.title}</li>)}</ul>
            <button data-testid="follow" onClick={() => addAuthorToFeed(AUTHOR)}>follow</button>
        </div>
    );
}

beforeEach(() => { localStorage.setItem('auth-token', 'test-token'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('following an author merges their posts into the feed', () => {
    it("fetches the author's posts from the server and merges them", async () => {
        getExploreCards.mockResolvedValue({
            items: [
                { _id: 'p1', userId: AUTHOR, title: 'Their post', status: 'active', createdAt: '2026-03-01T00:00:00.000Z', likes: [], comments: [] },
            ],
            nextCursor: null,
        });

        render(<CardsProvider><Harness /></CardsProvider>);
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));

        await act(async () => { screen.getByTestId('follow').click(); });

        // Asked the SERVER for that author's posts — not a global cards array.
        expect(getExploreCards).toHaveBeenCalledWith(undefined, 10, AUTHOR);
        expect(await screen.findByText('Their post')).toBeInTheDocument();
    });

    it('does not duplicate a post already in the feed', async () => {
        getExploreCards.mockResolvedValue({
            items: [
                { _id: 'p1', userId: AUTHOR, title: 'Their post', status: 'active', createdAt: '2026-03-01T00:00:00.000Z', likes: [], comments: [] },
            ],
            nextCursor: null,
        });

        render(<CardsProvider><Harness /></CardsProvider>);
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));

        await act(async () => { screen.getByTestId('follow').click(); });
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

        // Follow again (e.g. unfollow/refollow): the same post must not be added twice.
        await act(async () => { screen.getByTestId('follow').click(); });
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    });
});
