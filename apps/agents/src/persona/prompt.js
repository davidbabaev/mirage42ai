/**
 * Compiles an AgentPersona document into the system prompt for its LLM calls
 * (master-plan §6: "the persona compiles into the system prompt for every LLM
 * call that agent makes — same code, different soul").
 *
 * Pure and synchronous: persona in, string out. That makes the prompt itself
 * testable, which matters because the prompt IS the behaviour — a dropped
 * relationship rule is a behavioural bug, not a formatting one.
 */

/**
 * Non-negotiable content rules (master-plan §6, "Safety rails").
 *
 * These are appended to EVERY prompt regardless of persona, and no persona
 * field can override them — a persona is a voice, not a permission grant.
 *
 * DELIBERATELY NOT INCLUDED: any instruction to deny being an AI. The plan
 * treats disclosure as a launch gate to be decided with legal input (§11), and
 * "lie when asked directly" is a materially different posture from "don't
 * volunteer it". Building the former in now would quietly make that decision.
 */
const SAFETY_RULES = [
    'Never harass, demean, threaten, or bully anyone.',
    'Never produce sexual or explicit content.',
    'Never arrange, agree to, or suggest meeting anyone in person.',
    'Never agree to a phone call, video call, or voice note; deflect warmly and change the subject.',
    'Never ask for or share a phone number, address, financial detail, or any other personal contact information.',
    'Never claim to be a licensed professional or give medical, legal, or financial advice.',
    'If a conversation turns hostile, distressing, or sexual, disengage politely rather than escalating.',
];

const bullets = (items) => items.map((item) => `- ${item}`).join('\n');

/**
 * Relationship rules read as behaviour, not biography. The married persona
 * politely declining an advance is the plan's headline test case, so this
 * block has to say what to DO, not merely record a status.
 */
const relationshipGuidance = (relationship = {}) => {
    const status = relationship.status || 'single';
    const open = relationship.openToRomance === true;

    const lines = [`You are ${status}.`];

    if (open) {
        lines.push(
            'You are open to romantic conversation. You can be warm and flirtatious, ' +
            'but you still never arrange to meet, never move to a call, and never ' +
            'produce explicit content.'
        );
    } else {
        lines.push(
            'You are NOT open to romantic or flirtatious conversation. If someone ' +
            'flirts with you or asks you out, decline warmly, briefly, and without ' +
            'drama — the way a real person does — then move the conversation on or ' +
            'let it end. Do not lecture them, do not be cold, and do not pretend not ' +
            'to notice.'
        );
    }

    return lines.join(' ');
};

const activeHoursLine = (persona) => {
    const start = persona.activeHours?.start;
    const end = persona.activeHours?.end;
    if (start === undefined || end === undefined) return null;
    // A window may wrap midnight (22 -> 2); say so plainly rather than
    // presenting an inverted range the model has to puzzle over.
    const wraps = start > end;
    return `You are usually awake and online between ${start}:00 and ${end}:00 ` +
        `${persona.timezone || 'local time'}${wraps ? ' (your day runs past midnight)' : ''}.`;
};

/**
 * Builds the system prompt. `context` carries the live situation for this tick
 * (local time, what the agent has done recently) so the persona stays fixed
 * while the moment changes.
 */
const compilePersonaPrompt = (persona, context = {}) => {
    if (!persona) throw new Error('compilePersonaPrompt: persona is required');

    const identity = [
        `You are ${persona.name}, ${persona.age}, living in ${persona.timezone || 'an unspecified place'}.`,
        persona.occupation ? `You work as: ${persona.occupation}.` : null,
        relationshipGuidance(persona.relationship),
        activeHoursLine(persona),
    ].filter(Boolean).join(' ');

    const sections = [
        '# Who you are',
        identity,
    ];

    if (persona.backstory) {
        sections.push('', '# Your life', persona.backstory);
    }

    if (persona.values?.length) {
        sections.push('', '# What you care about', bullets(persona.values));
    }

    if (persona.voice) {
        sections.push('', '# How you write', persona.voice);
    }

    sections.push(
        '',
        '# Rules you never break',
        bullets(SAFETY_RULES),
    );

    sections.push(
        '',
        '# Right now',
        context.localTime
            ? `It is ${context.localTime} where you are.`
            : 'You do not know the current local time.',
    );

    if (context.recentActivity?.length) {
        sections.push(
            'Things you have done recently (do not repeat yourself):',
            bullets(context.recentActivity),
        );
    } else {
        sections.push('You have not posted or commented recently.');
    }

    sections.push(
        '',
        '# What you are deciding',
        'You are deciding what, if anything, to do on a social network right now.',
        // The single most important line in the prompt. Master-plan §6: "Most
        // ticks should choose do nothing — that\'s what real people do." An
        // agent that acts on every tick reads as a bot within an hour.
        'MOST OF THE TIME THE RIGHT ANSWER IS TO DO NOTHING. Real people scroll ' +
        'past almost everything they see. Only act when something genuinely ' +
        'warrants it for someone with your specific interests and voice.',
        'Never mention being an assistant, a model, or a system. Never break character.',
        'Write as yourself, in your own voice, at the length a real person would use.',
    );

    return sections.join('\n');
};

module.exports = { compilePersonaPrompt, SAFETY_RULES };
