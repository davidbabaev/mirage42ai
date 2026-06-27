import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

const toggleFollow = vi.fn(() => Promise.resolve());
vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({ toggleFollow, isFollowByMe: () => false, getFollowersCount: () => 0 }),
}));

import PeopleModal from '../src/components/PeopleModal';

const makeUsers = (n) => Array.from({ length: n }, (_, i) => ({ _id: `u${i}`, name: `P${i}`, lastName: 'Z', job: 'job' }));

const renderModal = (props) =>
    render(
        <MemoryRouter>
            <PeopleModal open title='People' onClose={() => {}} {...props} />
        </MemoryRouter>
    );

beforeEach(() => { navigate.mockClear(); toggleFollow.mockClear(); });
afterEach(() => cleanup());

describe('PeopleModal', () => {
    it('paginates with Load more (PAGE=8)', () => {
        renderModal({ users: makeUsers(20), mode: 'mutual' });
        expect(screen.getByText('P0 Z')).toBeInTheDocument();
        expect(screen.queryByText('P8 Z')).not.toBeInTheDocument(); // beyond first page
        fireEvent.click(screen.getByRole('button', { name: /load more/i }));
        expect(screen.getByText('P8 Z')).toBeInTheDocument();
    });

    it('navigates to a profile when a user is clicked', () => {
        renderModal({ users: makeUsers(3), mode: 'mutual' });
        fireEvent.click(screen.getByText('P1 Z'));
        expect(navigate).toHaveBeenCalledWith('/profiledashboard/u1/profilemain');
    });

    it('a followed suggestion lingers, then leaves after ~5s', async () => {
        vi.useFakeTimers();
        try {
            renderModal({ users: makeUsers(2), mode: 'suggested' });
            const followBtns = screen.getAllByRole('button', { name: /follow/i });
            await act(async () => { fireEvent.click(followBtns[0]); });
            expect(toggleFollow).toHaveBeenCalledWith('u0');
            // still visible right after following
            expect(screen.getByText('P0 Z')).toBeInTheDocument();
            // ...gone after the linger window
            act(() => { vi.advanceTimersByTime(5000); });
            expect(screen.queryByText('P0 Z')).not.toBeInTheDocument();
            expect(screen.getByText('P1 Z')).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('mutual mode does NOT remove on follow', async () => {
        renderModal({ users: makeUsers(2), mode: 'mutual' });
        const followBtns = screen.getAllByRole('button', { name: /follow/i });
        await act(async () => { fireEvent.click(followBtns[0]); });
        expect(screen.getByText('P0 Z')).toBeInTheDocument(); // stays
    });
});
