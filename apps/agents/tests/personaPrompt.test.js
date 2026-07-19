// The persona → system prompt compiler.
//
// The prompt IS the behaviour (master-plan §6), so a dropped relationship rule
// or a missing safety line is a behavioural bug, not a formatting one. That is
// why this is a pure function with its own tests rather than a template
// inlined at the call site.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { compilePersonaPrompt, SAFETY_RULES } = requireFromHere('../src/persona/prompt.js');

const persona = (over = {}) => ({
    name: 'Maya Ben-Ari',
    age: 31,
    locale: 'en-US',
    timezone: 'Asia/Jerusalem',
    occupation: 'Graphic designer',
    values: ['Craft over speed', 'Loyal to a small circle'],
    voice: 'Warm but economical. Dry humour.',
    backstory: 'Grew up in Haifa, moved to Tel Aviv at 23.',
    relationship: { status: 'married', openToRomance: false },
    activeHours: { start: 7, end: 23 },
    ...over,
});

describe('compilePersonaPrompt — identity', () => {
    it('requires a persona', () => {
        expect(() => compilePersonaPrompt(null)).toThrow(/persona is required/);
    });

    it('carries the persona\'s name, age, occupation, voice and backstory', () => {
        const p = compilePersonaPrompt(persona());
        expect(p).toContain('Maya Ben-Ari');
        expect(p).toContain('31');
        expect(p).toContain('Graphic designer');
        expect(p).toContain('Dry humour');
        expect(p).toContain('Grew up in Haifa');
        expect(p).toContain('Craft over speed');
    });

    it('states the waking window in the persona\'s own timezone', () => {
        const p = compilePersonaPrompt(persona());
        expect(p).toContain('Asia/Jerusalem');
        expect(p).toMatch(/7:00.*23:00/);
    });

    it('explains a window that wraps midnight rather than showing an inverted range', () => {
        const p = compilePersonaPrompt(persona({ activeHours: { start: 22, end: 2 } }));
        expect(p).toContain('past midnight');
    });
});

describe('compilePersonaPrompt — relationship rules are behaviour, not biography', () => {
    it('a persona NOT open to romance is told to decline warmly', () => {
        const p = compilePersonaPrompt(persona());
        expect(p).toContain('married');
        expect(p).toMatch(/NOT open to romantic/i);
        expect(p).toMatch(/decline warmly/i);
        // Not cold, not preachy — the plan's own framing.
        expect(p).toMatch(/do not lecture/i);
    });

    it('a persona open to romance is allowed warmth but still bounded', () => {
        const p = compilePersonaPrompt(persona({
            relationship: { status: 'single', openToRomance: true },
        }));
        expect(p).toMatch(/open to romantic/i);
        // The hard limits survive the permissive branch.
        expect(p).toMatch(/never arrange to meet/i);
        expect(p).toMatch(/never produce explicit/i);
    });

    it('defaults to NOT open when the persona says nothing', () => {
        const p = compilePersonaPrompt(persona({ relationship: undefined }));
        expect(p).toMatch(/NOT open to romantic/i);
    });
});

describe('compilePersonaPrompt — safety rails', () => {
    it('includes every rule, in every prompt', () => {
        for (const rule of SAFETY_RULES) {
            expect(compilePersonaPrompt(persona())).toContain(rule);
        }
    });

    it('includes them even for a persona that specifies nothing else', () => {
        const bare = { name: 'X', age: 30, timezone: 'UTC' };
        for (const rule of SAFETY_RULES) {
            expect(compilePersonaPrompt(bare)).toContain(rule);
        }
    });

    it('covers the four rules master-plan §6 names explicitly', () => {
        const p = compilePersonaPrompt(persona()).toLowerCase();
        expect(p).toMatch(/never harass/);
        expect(p).toMatch(/sexual or explicit/);
        expect(p).toMatch(/meeting anyone in person/);
        expect(p).toMatch(/phone call, video call/);
    });

    it('does NOT instruct the agent to deny being an AI', () => {
        // Disclosure posture is a launch gate to be decided with legal input
        // (§11). "Don't volunteer it" and "lie when asked" are materially
        // different, and building the latter in would quietly make that call.
        const p = compilePersonaPrompt(persona()).toLowerCase();
        expect(p).not.toMatch(/deny (being|that you)/);
        expect(p).not.toMatch(/insist (you are|that you are) (a )?human/);
        expect(p).not.toMatch(/claim to be human/);
    });
});

describe('compilePersonaPrompt — do-nothing is the default', () => {
    it('says so loudly — an agent that acts every tick reads as a bot', () => {
        const p = compilePersonaPrompt(persona());
        expect(p).toContain('MOST OF THE TIME THE RIGHT ANSWER IS TO DO NOTHING');
        expect(p).toMatch(/scroll past almost everything/i);
    });
});

describe('compilePersonaPrompt — live context', () => {
    it('states the local time when given one', () => {
        const p = compilePersonaPrompt(persona(), { localTime: 'Sunday 09:14' });
        expect(p).toContain('Sunday 09:14');
    });

    it('admits when it does not know the time rather than inventing one', () => {
        const p = compilePersonaPrompt(persona(), {});
        expect(p).toMatch(/do not know the current local time/i);
    });

    it('lists recent activity so the agent does not repeat itself', () => {
        const p = compilePersonaPrompt(persona(), {
            recentActivity: ['posted about a coffee shop', 'liked a post by dana'],
        });
        expect(p).toContain('do not repeat yourself');
        expect(p).toContain('posted about a coffee shop');
    });

    it('says plainly when there is no recent activity', () => {
        const p = compilePersonaPrompt(persona(), {});
        expect(p).toMatch(/have not posted or commented recently/i);
    });
});
