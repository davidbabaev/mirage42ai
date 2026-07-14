import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

vi.mock('../src/providers/cardsContext', () => ({
    useCardsProvider: () => ({ registeredCards: [] }),
}));

import Notifications from '../src/components/Notifications';

// Sender is now embedded on the notification by the server (no global users scan).
const makeNotification = (overrides = {}) => ({
    _id: 'n1',
    fromUser: 'u1',
    sender: { _id: 'u1', name: 'Alice', lastName: 'Smith', profilePicture: '' },
    whichCard: 'c1',
    actionType: 'like',
    isRead: true,
    createdAt: new Date().toISOString(),
    ...overrides,
});

const renderNotifications = (notifications, handleDelete = vi.fn(), onClose = vi.fn()) =>
    render(
        <MemoryRouter>
            <Notifications
                notificationsValue={notifications}
                handleDeleteNotificationValue={handleDelete}
                onClose={onClose}
            />
        </MemoryRouter>
    );

beforeEach(() => { navigate.mockClear(); });
afterEach(() => cleanup());

describe('Notifications — delete button', () => {
    it('calls the delete handler when the trash icon is clicked', () => {
        const handleDelete = vi.fn();
        renderNotifications([makeNotification()], handleDelete);
        const deleteBtn = screen.getByRole('button');
        fireEvent.click(deleteBtn);
        expect(handleDelete).toHaveBeenCalledWith('n1');
    });

    it('does NOT navigate when the delete button is clicked', () => {
        const handleDelete = vi.fn();
        renderNotifications([makeNotification()], handleDelete);
        const deleteBtn = screen.getByRole('button');
        fireEvent.click(deleteBtn);
        expect(navigate).not.toHaveBeenCalled();
    });
});

describe('Notifications — navigation by actionType', () => {
    it('like notification navigates to the post page', () => {
        const onClose = vi.fn();
        renderNotifications([makeNotification({ actionType: 'like', whichCard: 'c1' })], vi.fn(), onClose);
        fireEvent.click(screen.getByRole('listitem'));
        expect(navigate).toHaveBeenCalledWith('/allcards?card=c1');
        expect(onClose).toHaveBeenCalled();
    });

    it('comment notification navigates to the post page', () => {
        const onClose = vi.fn();
        renderNotifications([makeNotification({ actionType: 'comment', whichCard: 'c1' })], vi.fn(), onClose);
        fireEvent.click(screen.getByRole('listitem'));
        expect(navigate).toHaveBeenCalledWith('/allcards?card=c1');
    });

    it('comment-reply notification navigates to the post with comment anchor', () => {
        const onClose = vi.fn();
        renderNotifications(
            [makeNotification({ actionType: 'comment-reply', whichCard: 'c1', commentId: 'cmt1' })],
            vi.fn(),
            onClose,
        );
        fireEvent.click(screen.getByRole('listitem'));
        expect(navigate).toHaveBeenCalledWith('/allcards?card=c1&comment=cmt1');
    });

    it('comment-like notification navigates to the post with comment anchor', () => {
        const onClose = vi.fn();
        renderNotifications(
            [makeNotification({ actionType: 'comment-like', whichCard: 'c1', commentId: 'cmt1' })],
            vi.fn(),
            onClose,
        );
        fireEvent.click(screen.getByRole('listitem'));
        expect(navigate).toHaveBeenCalledWith('/allcards?card=c1&comment=cmt1');
    });

    it('comment-reply without commentId falls back to the post page without anchor', () => {
        renderNotifications([makeNotification({ actionType: 'comment-reply', whichCard: 'c1', commentId: undefined })]);
        fireEvent.click(screen.getByRole('listitem'));
        expect(navigate).toHaveBeenCalledWith('/allcards?card=c1');
    });

    it('follow notification still navigates to the sender profile', () => {
        const onClose = vi.fn();
        renderNotifications([makeNotification({ actionType: 'follow' })], vi.fn(), onClose);
        fireEvent.click(screen.getByRole('listitem'));
        expect(navigate).toHaveBeenCalledWith('/profiledashboard/u1/profilemain');
    });

    it('post-removed notification navigates to /allcards', () => {
        const onClose = vi.fn();
        renderNotifications(
            [makeNotification({ actionType: 'post-removed', fromUser: undefined })],
            vi.fn(),
            onClose,
        );
        fireEvent.click(screen.getByRole('listitem'));
        expect(navigate).toHaveBeenCalledWith('/allcards');
    });
});

describe('Notifications — actionType copy', () => {
    it('renders "commented on your post" for comment actionType', () => {
        renderNotifications([makeNotification({ actionType: 'comment' })]);
        expect(screen.getByText(/commented on your post/i)).toBeInTheDocument();
    });

    it('renders "followed you" for follow actionType', () => {
        renderNotifications([makeNotification({ actionType: 'follow' })]);
        expect(screen.getByText(/followed you/i)).toBeInTheDocument();
    });

    it('renders "liked your post" for like actionType', () => {
        renderNotifications([makeNotification({ actionType: 'like' })]);
        expect(screen.getByText(/liked your post/i)).toBeInTheDocument();
    });

    it('renders "liked your comment" for comment-like actionType', () => {
        renderNotifications([makeNotification({ actionType: 'comment-like' })]);
        expect(screen.getByText(/liked your comment/i)).toBeInTheDocument();
    });

    it('renders "replied to your comment" for comment-reply actionType', () => {
        renderNotifications([makeNotification({ actionType: 'comment-reply' })]);
        expect(screen.getByText(/replied to your comment/i)).toBeInTheDocument();
    });

    it('renders a system message for post-removed actionType', () => {
        renderNotifications([makeNotification({ actionType: 'post-removed', fromUser: undefined })]);
        expect(screen.getByText(/post was removed/i)).toBeInTheDocument();
    });
});
