// The CORS allowlist is the single source of truth shared by the HTTP cors
// middleware and the socket.io config. It must: read ALLOWED_ORIGINS (comma-
// separated), ALWAYS allow the canonical production origin in production (even
// with no env set), always include the Vite dev origin outside production, and
// NOT leak that dev origin into a production allowlist.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAllowedOrigins, DEV_ORIGIN, PROD_ORIGIN } from '../src/config/allowedOrigins.js';

const ENV_KEYS = ['ALLOWED_ORIGINS', 'NODE_ENV'];
let saved;

beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
    for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
});

describe('getAllowedOrigins', () => {
    it('includes the dev origin outside production even with no env set', () => {
        delete process.env.ALLOWED_ORIGINS;
        delete process.env.NODE_ENV;
        expect(getAllowedOrigins()).toEqual([DEV_ORIGIN]);
    });

    it('always allows the canonical prod origin in production, even with no ALLOWED_ORIGINS', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOWED_ORIGINS;
        expect(getAllowedOrigins()).toEqual([PROD_ORIGIN]);
    });

    it('parses comma-separated ALLOWED_ORIGINS (which extend the prod origin) and trims whitespace', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOWED_ORIGINS = 'https://a.vercel.app, https://b.com';
        expect(getAllowedOrigins()).toEqual([PROD_ORIGIN, 'https://a.vercel.app', 'https://b.com']);
    });

    it('does NOT include the dev origin in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOWED_ORIGINS = 'https://a.vercel.app';
        expect(getAllowedOrigins()).toEqual([PROD_ORIGIN, 'https://a.vercel.app']);
        expect(getAllowedOrigins()).not.toContain(DEV_ORIGIN);
    });

    it('de-dupes when ALLOWED_ORIGINS redundantly lists the prod origin in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
        expect(getAllowedOrigins()).toEqual([PROD_ORIGIN]);
    });

    it('appends the dev origin to env origins outside production', () => {
        process.env.NODE_ENV = 'development';
        process.env.ALLOWED_ORIGINS = 'https://staging.vercel.app';
        expect(getAllowedOrigins()).toEqual(['https://staging.vercel.app', DEV_ORIGIN]);
    });

    it('de-dupes when ALLOWED_ORIGINS already lists the dev origin in dev', () => {
        delete process.env.NODE_ENV;
        process.env.ALLOWED_ORIGINS = DEV_ORIGIN;
        expect(getAllowedOrigins()).toEqual([DEV_ORIGIN]);
    });

    it('ignores empty entries from trailing/double commas', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOWED_ORIGINS = 'https://a.com,,https://b.com,';
        expect(getAllowedOrigins()).toEqual([PROD_ORIGIN, 'https://a.com', 'https://b.com']);
    });
});
