import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The post author (byline name + job) must render from the SERVER-EMBEDDED
// `card.creator`, with NO global users array. This is the state the app is in
// once the load-everything providers are retired: `users` is empty, so a card
// that still resolved its author via `users.find(...)` would render a blank
// byline. Mocking users as [] is the whole point of the test — don't "fix" it
// by seeding a user here.

vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({ users: [] }),
}));
vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: 'me' }, isLoggedIn: true }),
}));
vi.mock('../src/hooks/useLikedCards', () => ({
    default: () => ({ toggleLike: vi.fn(), isLikeByMe: () => false, getLikeCount: () => 0 }),
}));
vi.mock('../src/hooks/useCommentsCards', () => ({
    default: () => ({ addComment: vi.fn(), countComments: () => 0, removeComment: vi.fn() }),
}));
vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({ toggleFollow: vi.fn(), isFollowByMe: () => false, getFollowersCount: () => 0 }),
}));

import CardItem from '../src/components/CardItem';

const CARD = {
    _id: 'card1',
    userId: 'author1',
    title: 'A post',
    content: 'body text',
    likes: [],
    comments: [],
    likePreview: [],
    createdAt: new Date().toISOString(),
    creator: {
        _id: 'author1',
        name: 'Alice',
        lastName: 'Poster',
        profilePicture: '',
        job: 'Photographer',
    },
};

const renderCard = (card) => render(
    <MemoryRouter>
        <CardItem card={card} setOpenCommentCardId={vi.fn()} />
    </MemoryRouter>
);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('card author renders from the server embed (no global users array)', () => {
    it('shows the author name and job from card.creator', () => {
        renderCard(CARD);
        expect(screen.getByText(/Alice/)).toBeInTheDocument();
        expect(screen.getByText(/Poster/)).toBeInTheDocument();
        expect(screen.getByText('Photographer')).toBeInTheDocument();
    });

    it('does not crash when the author was deleted (creator: null)', () => {
        // Server sends creator: null for a deleted author — the card must still
        // render rather than take the whole feed down.
        expect(() => renderCard({ ...CARD, creator: null })).not.toThrow();
        expect(screen.getByText('body text')).toBeInTheDocument();
    });
});
