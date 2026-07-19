// The startup catch-up pass.
//
// DMs arrive over a socket event. If nobody is listening when it fires, the
// message is never seen again — so before this, restarting the worker silently
// dropped every pending conversation. The person who messaged got nothing, and
// nothing anywhere recorded that it had happened.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { sweepUnread } = requireFromHere('../src/dm/unreadSweep.js');

const AGENT_ID = 'agent-1';

const convo = (over = {}) => ({
    _id: 'conv-1',
    unreadCount: 2,
    otherUser: { _id: 'david-1', name: 'David', lastName: 'Cohen' },
    lastMessage: { text: 'you around?', senderId: 'david-1' },
    ...over,
});

const sessionReturning = (...pages) => {
    const request = vi.fn();
    pages.forEach((p) => request.mockResolvedValueOnce(p));
    request.mockResolvedValue({ conversations: [], nextCursor: null });
    return { request };
};

const runSweep = async (session, over = {}) => {
    const seen = [];
    const result = await sweepUnread({
        session,
        agentUserId: AGENT_ID,
        onConversation: (t) => seen.push(t),
        logger: { error: () => {}, log: () => {} },
        ...over,
    });
    return { seen, result };
};

describe('unread sweep on startup', () => {
    it('queues ONE trigger per unread conversation, not one per missed message', async () => {
        const session = sessionReturning({
            conversations: [convo({ unreadCount: 6 })],
            nextCursor: null,
        });

        const { seen, result } = await runSweep(session);

        expect(seen).toHaveLength(1);                 // six messages, ONE reply
        expect(result).toEqual({ conversations: 1, messages: 6 });
        expect(seen[0]).toMatchObject({
            conversationId: 'conv-1',
            userId: 'david-1',
            fromSweep: true,
        });
    });

    it('ignores conversations with nothing unread', async () => {
        const session = sessionReturning({
            conversations: [
                convo({ _id: 'a', unreadCount: 0 }),
                convo({ _id: 'b', unreadCount: 3 }),
            ],
            nextCursor: null,
        });

        const { seen } = await runSweep(session);

        expect(seen.map((t) => t.conversationId)).toEqual(['b']);
    });

    it('never answers its OWN last message', async () => {
        // unreadCount should never be >0 here, but if the server ever said so,
        // replying to yourself is the worst possible outcome.
        const session = sessionReturning({
            conversations: [convo({ lastMessage: { text: 'mine', senderId: AGENT_ID } })],
            nextCursor: null,
        });

        const { seen } = await runSweep(session);

        expect(seen).toHaveLength(0);
    });

    it('skips a row with no counterpart rather than throwing', async () => {
        const session = sessionReturning({
            conversations: [convo({ otherUser: null })],
            nextCursor: null,
        });

        const { seen } = await runSweep(session);

        expect(seen).toHaveLength(0);
    });

    it('follows nextCursor across pages', async () => {
        const session = sessionReturning(
            { conversations: [convo({ _id: 'a' })], nextCursor: 'CUR1' },
            { conversations: [convo({ _id: 'b' })], nextCursor: null },
        );

        const { seen } = await runSweep(session);

        expect(seen.map((t) => t.conversationId)).toEqual(['a', 'b']);
        expect(session.request.mock.calls[1][0]).toContain('cursor=CUR1');
    });

    it('is BOUNDED — it will not walk an unbounded conversation list on boot', async () => {
        const session = { request: vi.fn(async () => ({
            conversations: [convo()], nextCursor: 'ALWAYS-MORE',
        })) };

        await runSweep(session, { maxPages: 3 });

        expect(session.request).toHaveBeenCalledTimes(3);
    });

    it('a failing /chats does not stop the worker coming up', async () => {
        const session = { request: vi.fn(async () => { throw new Error('ECONNREFUSED'); }) };

        const { seen, result } = await runSweep(session);

        expect(seen).toHaveLength(0);
        expect(result).toEqual({ conversations: 0, messages: 0 });
    });
});
