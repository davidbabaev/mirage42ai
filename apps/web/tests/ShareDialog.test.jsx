import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Share dialog: external copy-link writes a deep link to the clipboard, and
// in-app share emits the post to the chosen user over the chat socket.

const ME = 'me-id';
const SARAH = { _id: 'sarah-id', name: 'Sarah', lastName: 'Levi', profilePicture: '' };

vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({ user: { _id: ME } }),
}));
vi.mock('../src/providers/UsersProvider', () => ({
    useUsersProvider: () => ({ users: [{ _id: ME, name: 'Me', lastName: 'Self' }, SARAH] }),
}));
const emit = vi.fn();
vi.mock('../src/services/socketService', () => ({
    getSocket: () => ({ emit }),
}));

import ShareDialog from '../src/components/ShareDialog';

const card = { _id: 'c1', title: 'Hello World' };

beforeEach(() => {
    emit.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
    });
});
afterEach(() => cleanup());

describe('ShareDialog', () => {
    it('shows a deep link to the post', () => {
        render(<ShareDialog card={card} open onClose={() => {}} />);
        const field = screen.getByDisplayValue(/\/allcards\?card=c1$/);
        expect(field).toBeInTheDocument();
    });

    it('copies the deep link to the clipboard', async () => {
        render(<ShareDialog card={card} open onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /copy/i }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
        expect(navigator.clipboard.writeText.mock.calls[0][0]).toMatch(/\/allcards\?card=c1$/);
    });

    it('sends the post to a chosen user over the chat socket', async () => {
        render(<ShareDialog card={card} open onClose={() => {}} />);
        // open the recipient autocomplete and pick Sarah
        const input = screen.getByPlaceholderText('Search people...');
        fireEvent.mouseDown(input);
        fireEvent.change(input, { target: { value: 'Sarah' } });
        const option = await screen.findByText('Sarah Levi');
        fireEvent.click(option);

        fireEvent.click(screen.getByRole('button', { name: /send/i }));

        expect(emit).toHaveBeenCalledTimes(1);
        const [event, payload] = emit.mock.calls[0];
        expect(event).toBe('send-message');
        expect(payload.toUser).toBe('sarah-id');
        expect(payload.text).toMatch(/\/allcards\?card=c1/);
        expect(payload.text).toContain('Hello World');
    });
});
