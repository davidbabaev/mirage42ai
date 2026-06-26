import { describe, it, expect } from 'vitest';
import { add } from '../src/_autopilot_smoke.js';

describe('autopilot smoke', () => {
    it('adds two numbers', () => {
        expect(add(2, 3)).toBe(5);
    });
});
