import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from './test-utils/render-with-router';

// vi.mock factories are hoisted above all imports, so any shared mock
// functions they close over need to be set up via vi.hoisted to also run
// before the imports.
const mocks = vi.hoisted(() => ({
    register: vi.fn(),
    edit: vi.fn(),
}));

vi.mock('../src/providers/AuthProvider', () => ({
    useAuth: () => ({
        user: { _id: 'u1', name: 'Alice', lastName: 'A', profilePicture: '' },
    }),
}));

vi.mock('../src/providers/CardsProvider', () => ({
    useCardsProvider: () => ({
        handleCardRegister: mocks.register,
        handleEditCard: mocks.edit,
    }),
}));

import CreateCardModal from '../src/components/CreateCardModal';

beforeAll(() => {
    // jsdom doesn't implement these — the form's previewMedia useMemo calls
    // URL.createObjectURL as soon as a File lands in state.
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
    mocks.register.mockReset();
    mocks.edit.mockReset();
});

describe('CreateCardModal', () => {
    it('calls onClose after a successful submit, even when onCardPosted is not provided', async () => {
        mocks.register.mockResolvedValue({ success: true, message: 'ok' });

        const onClose = vi.fn();

        // Deliberately omit onCardPosted — this mirrors the NavBar usage in
        // src/components/NavBar.jsx where the prop is commented out. Pre-fix,
        // CreateCardModal's onSuccess calls onCardPosted() unconditionally so
        // it throws on `undefined()` and never reaches onClose(); the modal
        // gets stuck open. Post-fix the call is `onCardPosted?.()` and onClose
        // runs normally.
        const { container } = renderWithRouter(
            <CreateCardModal onClose={onClose} />
        );

        // Fill the required content field.
        fireEvent.change(screen.getByPlaceholderText(/what on your mind/i), {
            target: { value: 'Hello from the test' },
        });

        // Attach a fake media file to the hidden file input (the form requires
        // both text and media before the submit button is enabled).
        const fileInput = container.querySelector('input[type="file"]');
        fireEvent.change(fileInput, {
            target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Post' }));

        await waitFor(() => {
            expect(mocks.register).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });
});
