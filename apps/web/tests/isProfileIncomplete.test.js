import { describe, it, expect } from 'vitest';
import isProfileIncomplete from '../src/utils/isProfileIncomplete';

// Mirrors the sentinel defaults the backend's normalizeUser puts in place:
// "Not Defined" for free-text fields, "Unknown" for gender, '' for empty
// primitives, null for an unset birthDate.
const completeUser = {
    address: { country: 'USA', city: 'NYC', street: 'Main', house: 1, zip: 10001 },
    phone: '0501234567',
    age: 30,
    job: 'Engineer',
    gender: 'Male',
    birthDate: '1995-06-15',
    aboutMe: 'I love coding',
};

describe('isProfileIncomplete', () => {
    it('returns false for a fully filled profile', () => {
        expect(isProfileIncomplete(completeUser)).toBe(false);
    });

    // ---- The bug we are fixing ----
    // Pre-fix the original code wrote `country === "Not Defined" && ""`, which
    // short-circuits to "" (falsy). When ONLY country is at the placeholder and
    // every other field is filled, the rest of the || chain is also falsy, so
    // the function wrongly returns falsy and the "Complete your profile" prompt
    // never shows. Post-fix the country check contributes a clean boolean and
    // the function returns true.
    it('returns true when address.country is the placeholder "Not Defined" (regression for the && "" typo)', () => {
        const user = { ...completeUser, address: { ...completeUser.address, country: 'Not Defined' } };
        expect(isProfileIncomplete(user)).toBe(true);
    });

    it('returns true when job is the placeholder "Not Defined"', () => {
        expect(isProfileIncomplete({ ...completeUser, job: 'Not Defined' })).toBe(true);
    });

    it('returns true when gender is the placeholder "Unknown"', () => {
        expect(isProfileIncomplete({ ...completeUser, gender: 'Unknown' })).toBe(true);
    });

    it('returns true when aboutMe is the placeholder "Not Defined"', () => {
        expect(isProfileIncomplete({ ...completeUser, aboutMe: 'Not Defined' })).toBe(true);
    });

    it('returns true when phone is empty', () => {
        expect(isProfileIncomplete({ ...completeUser, phone: '' })).toBe(true);
    });

    it('returns true when birthDate is null', () => {
        expect(isProfileIncomplete({ ...completeUser, birthDate: null })).toBe(true);
    });

    it('returns false when no user is loaded yet (undefined / null)', () => {
        expect(isProfileIncomplete(undefined)).toBe(false);
        expect(isProfileIncomplete(null)).toBe(false);
    });
});
