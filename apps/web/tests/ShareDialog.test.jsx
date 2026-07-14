import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Share dialog: the external copy-link is the API's server-rendered OG route
// (/s/card/:id) so crawlers get a preview; the in-app picker shows recent DM
// contacts by default and shares the post to the chosen user over the chat
// socket as a sharedCard (cardId only — the server builds the preview).

const ME = 'me-id';
const SARAH = { _id: 'sarah-id', name: 'Sarah', lastName: 'Levi', displayName: 'Sarah Levi', profilePicture: '' };

vi.mock('../src/providers/authContext', () => ({
    useAuth: () => ({ user: { _id: ME } }),
}));
const emit = vi.fn();
vi.mock('../src/services/socketService', () => ({
    getSocket: () => ({ emit }),
}));
const getRecentContacts = vi.fn();
const searchUsers = vi.fn();
vi.mock('../src/services/apiService', () => ({
    getRecentContacts: (...a) => getRecentContacts(...a),
    searchUsers: (...a) => searchUsers(...a),
}));
// Make the debounced search resolve to its input immediately.
vi.mock('../src/hooks/useDebounce', () => ({ default: (v) => v }));

import ShareDialog from '../src/components/ShareDialog';

const card = { _id: 'c1', title: 'Hello World' };

beforeEach(() => {
    emit.mockClear();
    getRecentContacts.mockResolvedValue([SARAH]);
    searchUsers.mockResolvedValue([SARAH]);
    vi.stubEnv('VITE_API_URL', 'http://api.test');
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
    });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('ShareDialog', () => {
    it('shows the external OG share link (/s/card/:id)', () => {
        render(<ShareDialog card={card} open onClose={() => {}} />);
        expect(screen.getByDisplayValue('http://api.test/s/card/c1')).toBeInTheDocument();
    });

    it('copies the OG share link to the clipboard', async () => {
        render(<ShareDialog card={card} open onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /copy/i }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
        expect(navigator.clipboard.writeText.mock.calls[0][0]).toBe('http://api.test/s/card/c1');
    });

    it('shows recent DM contacts on open as the default list', async () => {
        render(<ShareDialog card={card} open onClose={() => {}} />);
        expect(getRecentContacts).toHaveBeenCalled();
        expect(await screen.findByText('Sarah Levi')).toBeInTheDocument();
        // it's the new search field, not the old autocomplete placeholder
        expect(screen.getByPlaceholderText('Search other people')).toBeInTheDocument();
    });

    it('shares the post to a chosen recipient as a sharedCard over the chat socket', async () => {
        render(<ShareDialog card={card} open onClose={() => {}} />);
        fireEvent.click(await screen.findByText('Sarah Levi')); // pick from the recent list
        fireEvent.click(screen.getByRole('button', { name: /send to sarah/i }));

        expect(emit).toHaveBeenCalledTimes(1);
        const [event, payload] = emit.mock.calls[0];
        expect(event).toBe('send-message');
        expect(payload).toEqual({ toUser: 'sarah-id', sharedCardId: 'c1' });
        expect(payload.text).toBeUndefined(); // cardId only — server builds the preview
    });
});
