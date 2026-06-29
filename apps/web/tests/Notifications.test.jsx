import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

vi.mock('../src/providers/CardsProvider', () => ({
    useCardsProvider: () => ({ registeredCards: [] }),
}));

vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({
        users: [
            { _id: 'u1', name: 'Alice', lastName: 'Smith', profilePicture: '' },
        ],
    }),
}));

import Notifications from '../src/components/Notifications';

const makeNotification = (overrides = {}) => ({
    _id: 'n1',
    fromUser: 'u1',
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
