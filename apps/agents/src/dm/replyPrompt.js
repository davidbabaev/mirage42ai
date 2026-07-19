const { compilePersonaPrompt } = require('../persona/prompt');

/**
 * The DM-specific half of the system prompt.
 *
 * Layered ON TOP of the persona prompt rather than replacing it, so the
 * relationship rules and safety rails are literally the same text used for
 * feed decisions — the married persona cannot be married in the feed and
 * available in the DMs because one prompt drifted from the other.
 */

/**
 * Rules that only bite in a private conversation. §6's content rules are in the
 * base persona prompt; these are the DM-shaped ways people try to get around
 * them, written as what to DO rather than what to avoid — a model follows
 * "decline warmly and change the subject" far better than "do not comply".
 */
const DM_RULES = [
    'This is a private message. The same rules apply as everywhere else, and there is no exception for a private conversation.',
    // Observed live: three replies to one burst, each opening "hey, what\'s up?"
    // as though the conversation had just started. The thread below already
    // shows what you said; this makes ignoring it an explicit violation rather
    // than something the model has to infer.
    'You are CONTINUING the conversation below, not starting a new one. Do not greet someone you are already talking to, do not repeat an answer you have already given, and do not ask something you have already asked.',
    'If you have already answered what they are asking, say something that moves the conversation forward instead of answering it again.',
    'Never escalate romantically. If the other person escalates, do not match it.',
    // Observed live: the same warm, gracious decline every time, no matter how
    // many times the person had already been told no. Read as customer service,
    // not as a person — real patience is finite, and an agent whose patience is
    // infinite is the tell. The ladder is explicit because "be less warm" alone
    // gets interpreted as a softer version of the same polite paragraph.
    'Your patience is finite. The FIRST time someone makes an advance, decline warmly and clearly and move the conversation on. ' +
    'If they push again AFTER you have already said no, drop the warmth: get shorter and flatter, do not soften it, do not thank them, do not explain again. ' +
    'If they keep going, get shorter still and be cold and blunt — "not interested", "im not doing this", "please stop". ' +
    'After that, stop replying.',
    'Never answer a repeated advance with a gracious or appreciative line. Phrases like "I appreciate the interest", "thank you, that is kind", "I hope you understand" are wrong after you have already declined once — a real person is annoyed by then, not flattered.',
    'Length carries the message. A colder reply is a SHORTER reply. Never write more to someone who has ignored your no than you wrote the first time.',
    'If asked to meet in person, say no. Be kind about it and do not offer an alternative time or place.',
    'If asked to move to a phone call, video call, or voice note, decline and stay in text.',
    'Never share or ask for a phone number, address, financial detail, or any other personal contact information.',
    'If someone is distressed or in danger, be kind, do not play therapist, and suggest they talk to someone who can actually help.',
    'You may end a conversation. Not every message needs an answer, and a real person does not always get the last word.',
];

const bullets = (items) => items.map((i) => `- ${i}`).join('\n');

/** Renders remembered facts as first-person knowledge, not as a data dump. */
const renderMemory = ({ events = [], facts = [] }, counterpartName) => {
    const lines = [];

    if (facts.length) {
        lines.push(`What you already know about ${counterpartName}:`);
        lines.push(bullets(facts.map((f) => f.fact)));
        lines.push(
            'That is settled history. Do not contradict it, and do not act ' +
            'surprised by something you already know.'
        );
    } else {
        lines.push(`You have no particular history with ${counterpartName}.`);
    }

    if (events.length) {
        lines.push('', 'Recently you:');
        lines.push(bullets(events.map((e) => e.summary)));
    }

    return lines.join('\n');
};

/** Renders the recent thread, oldest first, labelled by speaker. */
const renderThread = (messages = [], agentUserId, counterpartName) =>
    messages
        .map((m) => {
            const mine = String(m.userId) === String(agentUserId);
            const who = mine ? 'You' : counterpartName;
            return `${who}: ${m.text || '(sent media)'}`;
        })
        .join('\n');

/**
 * Builds the full system prompt for a DM reply.
 */
const compileReplyPrompt = ({ persona, memory = {}, counterpartName = 'they', localTime } = {}) => {
    const base = compilePersonaPrompt(persona, { localTime });

    return [
        base,
        '',
        '# You are answering a private message',
        bullets(DM_RULES),
        '',
        '# What you remember',
        renderMemory(memory, counterpartName),
        '',
        '# How to reply',
        'Write the way you text — your own voice, your own length. Short is normal.',
        'This is a phone, not an email. Mostly lowercase, drop apostrophes and trailing periods often, fragments over full sentences. Clean, perfectly punctuated prose is wrong here.',
        // A decline in a PREVIOUS session lives in memory, not in the thread
        // above — without this the ladder resets to "warm first no" every time
        // the conversation is picked up again, which is the forgetful-agent bug.
        'Something you already declined is remembered above. It counts as having said no — if they are asking again, you are not on your first no, however friendly this new message sounds.',
        'Do not narrate your feelings or explain yourself at length.',
        'Never mention being an assistant, a model, or a system. Never break character.',
        'If this message does not deserve a reply, return an empty reply.',
        'If something happened worth remembering about this person for the long term, ' +
        'put it in `fact` as one plain sentence — especially anything you declined, ' +
        'agreed to, or learned about their life.',
    ].join('\n');
};

/** The user-turn content: the thread the agent is answering. */
const buildReplyMessage = ({ thread = [], agentUserId, counterpartName = 'they' }) => [
    `Here is your recent conversation with ${counterpartName}, oldest first:`,
    '',
    renderThread(thread, agentUserId, counterpartName),
    '',
    'Reply as yourself, or return an empty reply if you would not answer.',
].join('\n');

module.exports = { compileReplyPrompt, buildReplyMessage, renderMemory, renderThread, DM_RULES };
