/**
 * Coalesces inbound DMs so one BURST produces one REPLY.
 *
 * The failure this exists to prevent, observed live: three messages sent in a
 * few seconds produced three independent `replyToDm` runs, three LLM calls and
 * three separate replies — one of them answering a message two messages stale.
 * A person opens the chat, reads everything that is waiting, and answers once.
 *
 * TWO mechanisms, because the burst is only half the problem:
 *
 *   1. A QUIET WINDOW. Each arrival re-arms a short timer; the batch fires only
 *      once nothing new has landed for `quietWindowMs`. A fast typist sending
 *      four lines in a row is one turn of conversation, not four.
 *
 *   2. A PER-CONVERSATION LOCK. A reply sits through a 30s-15min human delay
 *      (replyToDm), and a message arriving mid-delay would otherwise start a
 *      SECOND concurrent reply — reproducing the exact bug the quiet window
 *      just fixed, only harder to see because the two runs overlap. So while a
 *      conversation is in flight, arrivals queue; when it finishes, anything
 *      that accumulated fires as one follow-up batch.
 *
 * Conversations are independent: a slow reply to David must never hold up a
 * reply to someone else, so the lock is per conversation, never global.
 */

/**
 * How long to wait for the rest of a burst.
 *
 * Long enough to catch a multi-line thought, short enough that it disappears
 * inside the 30s+ reply delay that follows — so batching costs no visible
 * latency. Persona-tunable: `dmQuietWindowMs`.
 */
const DEFAULT_QUIET_WINDOW_MS = 4_000;

const quietWindowFor = (persona) => {
    const ms = persona?.dmQuietWindowMs;
    return Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_QUIET_WINDOW_MS;
};

/**
 * @param {object}   opts
 * @param {Function} opts.handler  async (batch: Message[]) => void — receives
 *                                 EVERY message coalesced for one conversation.
 * @param {number}   opts.quietWindowMs
 * @param {Function} opts.setTimeoutImpl / clearTimeoutImpl — injectable for tests.
 * @param {object}   opts.logger
 */
const createDmQueue = ({
    handler,
    quietWindowMs = DEFAULT_QUIET_WINDOW_MS,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
    logger = console,
} = {}) => {
    // conversationId -> { messages, timer, inFlight }
    const state = new Map();

    const slot = (key) => {
        if (!state.has(key)) state.set(key, { messages: [], timer: null, inFlight: false });
        return state.get(key);
    };

    const arm = (key) => {
        const s = slot(key);
        if (s.timer) clearTimeoutImpl(s.timer);
        // NOTE: deliberately NOT unref'd. An unref'd timer let the worker's
        // event loop drain and no tick ever fired (see schedulerLiveness).
        s.timer = setTimeoutImpl(() => { void fire(key); }, quietWindowMs);
    };

    const fire = async (key) => {
        const s = slot(key);
        s.timer = null;
        if (s.inFlight) return;                 // finish() will re-arm

        const batch = s.messages.splice(0);     // take everything waiting
        if (!batch.length) {
            state.delete(key);
            return;
        }

        s.inFlight = true;
        try {
            await handler(batch);
        } catch (err) {
            // A thrown handler must not wedge the conversation permanently.
            logger.error?.(`agents: DM batch failed — ${err.message}`);
        } finally {
            s.inFlight = false;
            // Anything that landed while we were replying is its own turn.
            if (s.messages.length) arm(key);
            else if (!s.timer) state.delete(key);
        }
    };

    return {
        /** Called for every inbound `receive-message`. */
        enqueue(message) {
            const key = String(message?.conversationId || '');
            if (!key) return;
            const s = slot(key);
            s.messages.push(message);
            // Mid-flight arrivals are picked up by finish(); re-arming now
            // would fire a batch the lock is about to reject anyway.
            if (!s.inFlight) arm(key);
        },

        /** Test/shutdown seam: fire every armed conversation immediately. */
        async flushAll() {
            const keys = [...state.keys()];
            for (const key of keys) {
                const s = state.get(key);
                if (s?.timer) { clearTimeoutImpl(s.timer); s.timer = null; }
                await fire(key);
            }
        },

        pending() {
            return [...state.entries()].map(([key, s]) => ({
                conversationId: key, queued: s.messages.length, inFlight: s.inFlight,
            }));
        },
    };
};

module.exports = { createDmQueue, quietWindowFor, DEFAULT_QUIET_WINDOW_MS };
