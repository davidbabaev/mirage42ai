import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockUser = {
    _id: 'u1',
    name: 'Alice',
    notificationPrefs: {
        likes: true,
        comments: true,
        follows: true,
        commentLikes: true,
        commentReplies: true,
    },
};
const mockSetUser = vi.fn((updater) => {
    if (typeof updater === 'function') {
        mockUser = updater(mockUser);
    } else {
        mockUser = updater;
    }
});

vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: mockUser, setUser: mockSetUser }),
}));

const mockUpdateNotificationPrefs = vi.fn();
vi.mock('../src/services/apiService', () => ({
    updateNotificationPrefs: (...args) => mockUpdateNotificationPrefs(...args),
}));

import NotificationSettingsSection from '../src/pages/dashboard/NotificationSettingsSection';

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderSection = () => render(<NotificationSettingsSection />);

// Use exact label strings (anchor with ^ $) to avoid false matches between
// "Likes" and "Comment likes", "Comments" and "Comment likes", etc.
const getLikesSwitch    = () => screen.getByRole('switch', { name: /^Likes$/i });
const getCommentsSwitch = () => screen.getByRole('switch', { name: /^Comments$/i });
const getFollowsSwitch  = () => screen.getByRole('switch', { name: /^Follows$/i });
const getCommentLikesSwitch    = () => screen.getByRole('switch', { name: /^Comment likes$/i });
const getCommentRepliesSwitch  = () => screen.getByRole('switch', { name: /^Comment replies$/i });

beforeEach(() => {
    mockUser = {
        _id: 'u1',
        name: 'Alice',
        notificationPrefs: {
            likes: true,
            comments: true,
            follows: true,
            commentLikes: true,
            commentReplies: true,
        },
    };
    mockSetUser.mockClear();
    mockUpdateNotificationPrefs.mockReset();
});
afterEach(() => cleanup());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationSettingsSection', () => {
    it('renders a toggle for each preference type', () => {
        renderSection();
        expect(getLikesSwitch()).toBeInTheDocument();
        expect(getCommentsSwitch()).toBeInTheDocument();
        expect(getFollowsSwitch()).toBeInTheDocument();
        expect(getCommentLikesSwitch()).toBeInTheDocument();
        expect(getCommentRepliesSwitch()).toBeInTheDocument();
    });

    it('reflects stored prefs — checked when true', () => {
        renderSection();
        expect(getLikesSwitch()).toBeChecked();
        expect(getFollowsSwitch()).toBeChecked();
    });

    it('reflects stored prefs — unchecked when false', () => {
        mockUser = {
            ...mockUser,
            notificationPrefs: { ...mockUser.notificationPrefs, likes: false },
        };
        renderSection();
        expect(getLikesSwitch()).not.toBeChecked();
        // Others remain true.
        expect(getCommentsSwitch()).toBeChecked();
    });

    it('calls updateNotificationPrefs with the toggled key+value when a switch is clicked', async () => {
        mockUpdateNotificationPrefs.mockResolvedValue({
            notificationPrefs: { ...mockUser.notificationPrefs, likes: false },
        });
        renderSection();
        fireEvent.click(getLikesSwitch());
        await waitFor(() => {
            expect(mockUpdateNotificationPrefs).toHaveBeenCalledWith({ likes: false });
        });
    });

    it('updates the user in context after a successful API call', async () => {
        const updatedPrefs = { ...mockUser.notificationPrefs, likes: false };
        mockUpdateNotificationPrefs.mockResolvedValue({ notificationPrefs: updatedPrefs });
        renderSection();
        fireEvent.click(getLikesSwitch());
        await waitFor(() => {
            expect(mockSetUser).toHaveBeenCalled();
        });
    });

    it('shows an error alert when the API call fails and rolls back the toggle', async () => {
        mockUpdateNotificationPrefs.mockRejectedValue(new Error('Network error'));
        renderSection();
        const followsSwitch = getFollowsSwitch();
        expect(followsSwitch).toBeChecked();
        fireEvent.click(followsSwitch);
        // After error the toggle rolls back and an error alert appears.
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
        // Switch should be checked again (rolled back to original true).
        expect(getFollowsSwitch()).toBeChecked();
    });

    it('disables the toggled switch while the save is in flight', async () => {
        let resolve;
        mockUpdateNotificationPrefs.mockReturnValue(
            new Promise((r) => { resolve = r; })
        );
        renderSection();
        const commentsSwitch = getCommentsSwitch();
        fireEvent.click(commentsSwitch);
        // While in-flight the switch is disabled.
        expect(commentsSwitch).toBeDisabled();
        // Resolve and let the component settle.
        resolve({ notificationPrefs: { ...mockUser.notificationPrefs, comments: false } });
        await waitFor(() => expect(getCommentsSwitch()).not.toBeDisabled());
    });
});
