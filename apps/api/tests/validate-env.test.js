import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

// validateEnv.js is CommonJS and reads process.env at call time, so we can
// mutate env per case and call it directly — no app boot, no module reload.
const requireFromHere = createRequire(import.meta.url);
const validateEnv = requireFromHere('../src/utils/validateEnv');

// Every env key the function touches; snapshotted and restored around each test
// so we don't leak state into the rest of the suite (it runs single-fork).
const KEYS = [
    'NODE_ENV',
    'DB_CONNECTION_STRING',
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
];

let snapshot;

beforeEach(() => {
    snapshot = {};
    for (const k of KEYS) {
        snapshot[k] = process.env[k];
        delete process.env[k];
    }
    // Silence the optional-var warning so test output stays clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    for (const k of KEYS) {
        if (snapshot[k] === undefined) delete process.env[k];
        else process.env[k] = snapshot[k];
    }
    vi.restoreAllMocks();
});

describe('validateEnv', () => {
    it('throws naming the missing var when DB_CONNECTION_STRING is absent', () => {
        process.env.JWT_SECRET = 'secret';
        expect(() => validateEnv()).toThrow(/DB_CONNECTION_STRING/);
    });

    it('throws naming the missing var when JWT_SECRET is absent', () => {
        process.env.DB_CONNECTION_STRING = 'mongodb://localhost/test';
        expect(() => validateEnv()).toThrow(/JWT_SECRET/);
    });

    it('treats an empty-string var as missing', () => {
        process.env.DB_CONNECTION_STRING = '   ';
        process.env.JWT_SECRET = 'secret';
        expect(() => validateEnv()).toThrow(/DB_CONNECTION_STRING/);
    });

    it('does not throw outside production when only Cloudinary is missing, but warns', () => {
        process.env.NODE_ENV = 'development';
        process.env.DB_CONNECTION_STRING = 'mongodb://localhost/test';
        process.env.JWT_SECRET = 'secret';
        expect(() => validateEnv()).not.toThrow();
        // The optional-warn branch must actually fire for the missing Cloudinary keys.
        expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/CLOUDINARY/));
    });

    it('requires Cloudinary keys in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.DB_CONNECTION_STRING = 'mongodb://localhost/test';
        process.env.JWT_SECRET = 'secret';
        expect(() => validateEnv()).toThrow(/CLOUDINARY_CLOUD_NAME/);
    });

    it('treats a whitespace-only Cloudinary key as missing in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.DB_CONNECTION_STRING = 'mongodb://localhost/test';
        process.env.JWT_SECRET = 'secret';
        process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
        process.env.CLOUDINARY_API_KEY = '   ';
        process.env.CLOUDINARY_API_SECRET = 'shh';
        expect(() => validateEnv()).toThrow(/CLOUDINARY_API_KEY/);
    });

    it('passes in production when every required var (incl. Cloudinary) is set', () => {
        process.env.NODE_ENV = 'production';
        process.env.DB_CONNECTION_STRING = 'mongodb://localhost/test';
        process.env.JWT_SECRET = 'secret';
        process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
        process.env.CLOUDINARY_API_KEY = 'key';
        process.env.CLOUDINARY_API_SECRET = 'shh';
        expect(() => validateEnv()).not.toThrow();
    });
});
