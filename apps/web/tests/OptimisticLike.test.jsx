import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';

// The like on a post must be OPTIMISTIC: the count + filled-heart state flip the
// instant you click (before the server responds), reconcile with the server's
// authoritative card on success, and REVERT if the request fails. This guards
// the "like jank" fix (no network wait, no refetch).

const SEED_CARD = { _id: 'card1', userId: 'author', likes: [], comments: [] };

// Controllable like request so we can assert the UI BEFORE it resolves.
let likeDeferred;
const newDeferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

vi.mock('../src/services/apiService', () => ({
    getAllCards: vi.fn().mockResolvedValue([{ _id: 'card1', userId: 'author', likes: [], comments: [] }]),
    getFeedCards: vi.fn().mockResolvedValue({ cards: [], nextCursor: null }),
    likeUnlikeCard: vi.fn(() => { likeDeferred = newDeferred(); return likeDeferred.promise; }),
    // unused by this test but imported by CardsProvider:
    createCard: vi.fn(), deleteCard: vi.fn(), updateCard: vi.fn(),
    addComment: vi.fn(), removeComment: vi.fn(), likeUnlikeComment: vi.fn(),
    addReply: vi.fn(), banCard: vi.fn(),
}));
vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true }),
}));

import { CardsProvider } from '../src/providers/CardsProvider';
import useLikedCards from '../src/hooks/useLikedCards';

// The count hooks now take the card OBJECT (they resolve the overlay by _id,
// falling back to the card's own arrays); toggleLike still takes the id.
const CARD_REF = { _id: 'card1' };
function Harness() {
    const { isLikeByMe, getLikeCount, toggleLike } = useLikedCards();
    return (
        <div>
            <span data-testid="count">{getLikeCount(CARD_REF)}</span>
            <span data-testid="liked">{isLikeByMe(CARD_REF) ? 'yes' : 'no'}</span>
            <button data-testid="like" onClick={() => toggleLike('card1')}>like</button>
        </div>
    );
}

const renderHarness = () => render(<CardsProvider><Harness /></CardsProvider>);

beforeEach(() => { localStorage.setItem('auth-token', 'test-token'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe('optimistic post like', () => {
    it('flips count + heart immediately, before the server responds', async () => {
        renderHarness();
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
        expect(screen.getByTestId('liked')).toHaveTextContent('no');

        // Click — the request is pending (unresolved), so any change now is optimistic.
        fireEvent.click(screen.getByTestId('like'));
        expect(screen.getByTestId('count')).toHaveTextContent('1');
        expect(screen.getByTestId('liked')).toHaveTextContent('yes');

        // Server confirms with the authoritative card → state stays liked.
        await act(async () => {
            likeDeferred.resolve({ _id: 'card1', userId: 'author', likes: ['me'], comments: [] });
        });
        expect(screen.getByTestId('count')).toHaveTextContent('1');
        expect(screen.getByTestId('liked')).toHaveTextContent('yes');
    });

    it('reverts the optimistic flip if the request fails', async () => {
        renderHarness();
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));

        fireEvent.click(screen.getByTestId('like'));
        expect(screen.getByTestId('count')).toHaveTextContent('1'); // optimistic

        await act(async () => {
            likeDeferred.reject(new Error('network down'));
            await likeDeferred.promise.catch(() => {});
        });
        // rolled back
        expect(screen.getByTestId('count')).toHaveTextContent('0');
        expect(screen.getByTestId('liked')).toHaveTextContent('no');
    });
});
