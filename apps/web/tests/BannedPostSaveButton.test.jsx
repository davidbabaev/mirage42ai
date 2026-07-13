import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The save/favorite button used to render on a BANNED post (only admins see one in
// the feed). The server refuses to save a banned post — so clicking it 404'd and the
// optimistic add reverted silently. Hidden now, not disabled: a dead control on a
// removed post is just noise.

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

const mkCard = (over = {}) => ({
    _id: 'c1',
    userId: 'author1',
    title: 'A post',
    content: 'body',
    likes: [],
    comments: [],
    likePreview: [],
    createdAt: new Date().toISOString(),
    creator: { _id: 'author1', name: 'Ada', lastName: 'L', profilePicture: '', job: 'Dev' },
    ...over,
});

const renderCard = (card) => render(
    <MemoryRouter>
        <CardItem card={card} setOpenCommentCardId={vi.fn()} onSaveCard={vi.fn()} isSavedCard={false} />
    </MemoryRouter>
);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('save button on a banned post', () => {
    it('is shown on an active post', () => {
        renderCard(mkCard({ status: 'active' }));
        expect(screen.getByText('save')).toBeInTheDocument();
    });

    it('is shown when the post has no status (the normal case)', () => {
        renderCard(mkCard());
        expect(screen.getByText('save')).toBeInTheDocument();
    });

    it('is HIDDEN on a banned post — it could only ever 404', () => {
        renderCard(mkCard({ status: 'banned' }));
        expect(screen.queryByText('save')).not.toBeInTheDocument();
    });
});
