import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const toggleFollow = vi.fn();
vi.mock('../src/hooks/useFollowUser', () => ({
    default: () => ({ toggleFollow, isFollowByMe: () => false }),
}));

import MobileSuggestions from '../src/components/MobileSuggestions';

const sugg = [
    { _id: 'u1', name: 'Alice', lastName: 'Stone', job: 'Designer', profilePicture: '' },
    { _id: 'u2', name: 'Bob', lastName: 'Reed', job: 'Engineer', profilePicture: '' },
];

const renderIt = () =>
    render(
        <MemoryRouter>
            <MobileSuggestions suggestions={sugg} />
        </MemoryRouter>
    );

beforeEach(() => toggleFollow.mockClear());
afterEach(() => cleanup());

describe('MobileSuggestions', () => {
    it('renders the suggestion carousel with names', () => {
        renderIt();
        expect(screen.getByText('People you may know')).toBeInTheDocument();
        expect(screen.getByText('Alice Stone')).toBeInTheDocument();
        expect(screen.getByText('Bob Reed')).toBeInTheDocument();
    });

    // toggleFollow now takes the user OBJECT, not an id: the target's follower count
    // used to be derived by scanning the global users array, and with that gone the
    // object is what lets the count update on every surface.
    it('Follow button calls toggleFollow with the user', () => {
        renderIt();
        fireEvent.click(screen.getAllByRole('button', { name: /follow/i })[0]);
        expect(toggleFollow).toHaveBeenCalledWith(expect.objectContaining({ _id: 'u1' }));
    });

    it('"See all" opens a modal listing the suggestions', () => {
        renderIt();
        fireEvent.click(screen.getByRole('button', { name: /see all/i }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Alice Stone')).toBeInTheDocument();
        expect(within(dialog).getByText('Bob Reed')).toBeInTheDocument();
    });

    it('dismissing a card removes it from the strip', () => {
        renderIt();
        expect(screen.getByText('Alice Stone')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: /dismiss suggestion/i })[0]);
        expect(screen.queryByText('Alice Stone')).not.toBeInTheDocument();
        expect(screen.getByText('Bob Reed')).toBeInTheDocument();
    });
});
