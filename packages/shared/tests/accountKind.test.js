import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { ACCOUNT_KIND, ACCOUNT_KINDS, DEFAULT_ACCOUNT_KIND, isAccountKind } = require('../src/index.js');

describe('ACCOUNT_KIND', () => {
    it('exposes exactly the two kinds the data model allows', () => {
        expect(ACCOUNT_KIND).toEqual({ HUMAN: 'human', AGENT: 'agent' });
        expect(ACCOUNT_KINDS).toEqual(['human', 'agent']);
    });

    it('defaults to human — a user is a person unless we say otherwise', () => {
        expect(DEFAULT_ACCOUNT_KIND).toBe('human');
    });

    it('is frozen, so a consumer cannot mutate the contract at runtime', () => {
        expect(Object.isFrozen(ACCOUNT_KIND)).toBe(true);
        expect(Object.isFrozen(ACCOUNT_KINDS)).toBe(true);
    });

    it('validates membership', () => {
        expect(isAccountKind('human')).toBe(true);
        expect(isAccountKind('agent')).toBe(true);
        expect(isAccountKind('bot')).toBe(false);
        expect(isAccountKind(undefined)).toBe(false);
    });
});
