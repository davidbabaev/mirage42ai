import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

// The admin analytics genuinely need the whole users+cards dataset. What was wrong
// was WHERE it came from: the global providers loaded both collections at APP MOUNT
// for every visitor, so a normal user who never opens the admin dashboard still paid
// for the entire database. The dataset is now fetched when the Overview panel mounts.

vi.mock('../src/services/apiService', () => ({
    getAllUsers: vi.fn(),
    getAllCards: vi.fn(),
}));

import AdminAnalyticsProvider from '../src/pages/adminUserDashboard/AdminAnalyticsProvider';
import { useAdminAnalyticsData } from '../src/pages/adminUserDashboard/hooks/adminAnalyticsContext';
import { getAllUsers, getAllCards } from '../src/services/apiService';

function Consumer() {
    const { users, cards } = useAdminAnalyticsData();
    return <span data-testid="counts">{users.length}/{cards.length}</span>;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('admin analytics dataset is fetched on demand', () => {
    it('does not fetch until the panel mounts, then serves the dataset', async () => {
        getAllUsers.mockResolvedValue([{ _id: 'u1' }, { _id: 'u2' }]);
        getAllCards.mockResolvedValue([{ _id: 'c1' }]);

        // Nothing has mounted yet — the global providers no longer pull this.
        expect(getAllUsers).not.toHaveBeenCalled();
        expect(getAllCards).not.toHaveBeenCalled();

        render(<AdminAnalyticsProvider><Consumer /></AdminAnalyticsProvider>);

        await waitFor(() => expect(getAllUsers).toHaveBeenCalledTimes(1));
        expect(getAllCards).toHaveBeenCalledTimes(1);

        expect(await screen.findByTestId('counts')).toHaveTextContent('2/1');
    });

    it('shows an error state rather than a broken panel when the fetch fails', async () => {
        getAllUsers.mockRejectedValue(new Error('boom'));
        getAllCards.mockResolvedValue([]);

        render(<AdminAnalyticsProvider><Consumer /></AdminAnalyticsProvider>);

        expect(await screen.findByText(/Couldn't load the analytics/i)).toBeInTheDocument();
    });
});
