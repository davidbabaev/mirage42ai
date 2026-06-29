import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
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

// The composer validates that a chosen file is a decodable image before
// accepting it (via `new Image()`). jsdom never fires load/error events, so we
// stub Image: it fires onload normally, or onerror when imageShouldFail is set.
let imageShouldFail = false;

beforeAll(() => {
    // jsdom doesn't implement these — the form's previewMedia useMemo calls
    // URL.createObjectURL as soon as a File lands in state.
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();

    global.Image = class {
        set src(_value) {
            setTimeout(() => {
                if (imageShouldFail) {
                    this.onerror && this.onerror();
                } else {
                    this.naturalWidth = 100;
                    this.naturalHeight = 100;
                    this.onload && this.onload();
                }
            }, 0);
        }
    };
});

beforeEach(() => {
    imageShouldFail = false;
    mocks.register.mockReset();
    mocks.edit.mockReset();
});

afterEach(() => cleanup());

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

        // Wait for media validation to accept the file (Post enabled).
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Post' })).not.toBeDisabled();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Post' }));

        await waitFor(() => {
            expect(mocks.register).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });

    it('rejects a broken image and blocks posting', async () => {
        imageShouldFail = true;
        mocks.register.mockResolvedValue({ success: true, message: 'ok' });

        const { container } = renderWithRouter(<CreateCardModal onClose={vi.fn()} />);

        fireEvent.change(screen.getByPlaceholderText(/what on your mind/i), {
            target: { value: 'Hello from the test' },
        });

        const fileInput = container.querySelector('input[type="file"]');
        fireEvent.change(fileInput, {
            target: { files: [new File(['x'], 'broken.png', { type: 'image/png' })] },
        });

        // A clear broken-media error appears and the file is not accepted, so
        // the Post button stays disabled and submitting does nothing.
        await waitFor(() => {
            expect(screen.getByText(/broken/i)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
        expect(mocks.register).not.toHaveBeenCalled();
    });
});
