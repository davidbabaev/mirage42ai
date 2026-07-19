// Generate ONE image post now, for review (F5, §7).
//
//   node src/images/triggerImagePost.js "the sea from the promenade, early morning"
//   node src/images/triggerImagePost.js "her at a cafe in tel aviv" --face
//   node src/images/triggerImagePost.js "..." --caption "beach was unreal today"
//
// WHY THIS EXISTS: the worker only makes image posts when the model decides to,
// on a jittered ~15-minute heartbeat, where do_nothing is the correct answer
// most of the time. Waiting for a spontaneous photo is a coin flip measured in
// hours — useless for verifying the pipeline. This runs the REAL path on demand:
// same prompt builder, same provider call, same budget check, same review queue.
//
// It does NOT publish. It cannot: it ends at the pending queue exactly like the
// worker does, and an admin still has to approve. It also spends real money
// (one image) and real budget (one of the agent's daily image allowance).
require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), quiet: true });

const { AgentSession } = require('../session');
const actions = require('../api/actions');
const { BudgetLedger } = require('../budget');
const { readAgentCredentials, readRuntimeCredentials, readImageConfig } = require('../config');
const { generateAndQueueImage, SKIP } = require('./imagePost');

const log = (...args) => console.log('[trigger]', ...args);

const arg = (flag) => {
    const i = process.argv.indexOf(flag);
    return i === -1 ? null : process.argv[i + 1];
};

const main = async () => {
    const scene = process.argv[2];
    if (!scene || scene.startsWith('--')) {
        console.error('Usage: node src/images/triggerImagePost.js "<what the photo shows>" [--face] [--caption "..."]');
        process.exit(1);
    }

    const includeFace = process.argv.includes('--face');
    const caption = arg('--caption') || scene;

    const imageConfig = readImageConfig(process.env);
    if (!imageConfig.hasKey) {
        console.error('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set in apps/agents/.env — nothing to generate with.');
        process.exit(1);
    }
    log(`model ${imageConfig.model}`);

    // Same two sessions the worker uses, for the same reasons: the agent's own
    // token to act, the runtime's admin token to file the image for review.
    const session = new AgentSession({ ...readAgentCredentials(process.env), logger: console });
    const runtimeSession = new AgentSession({ ...readRuntimeCredentials(process.env), logger: console });

    await session.start();
    await runtimeSession.start();
    log(`authenticated as ${session.user?.name || 'agent'}`);

    const roster = (await runtimeSession.request('/agents/admin'))?.agents || [];
    const self = roster.find((a) => String(a.user._id) === String(session.user._id)) || roster[0];
    if (!self) throw new Error('no agent found in the roster');

    const identity = self.persona?.visualIdentity;
    log(`persona: ${self.persona?.name}`);
    log(
        identity?.referenceUrls?.length
            ? `reference face: ${identity.referenceUrls.length} portrait(s), primary ${identity.primaryUrl}`
            : 'reference face: NONE — a --face post will be refused (a faceless one is fine)'
    );

    const decision = {
        action: 'post',
        text: caption,
        imageScene: scene,
        imageIncludesFace: includeFace,
    };

    log(`generating: "${scene}"${includeFace ? ' (with her face)' : ' (no face)'}`);

    const result = await generateAndQueueImage({
        agent: self,
        session: runtimeSession,   // the queue is an admin surface
        decision,
        budget: new BudgetLedger(),
        imageConfig,
        api: actions,
    });

    if (result.queued) {
        log('');
        log(`QUEUED for review — pending id ${result.pendingId}`);
        log('Nothing is on the feed yet. Review it with:');
        log('  GET  /agents/admin/images');
        log(`  POST /agents/admin/images/${result.pendingId}/approve`);
        log(`  POST /agents/admin/images/${result.pendingId}/reject`);
    } else {
        log('');
        log(`NOT queued — ${result.skipped}${result.detail ? `: ${result.detail}` : ''}`);
        if (result.skipped === SKIP.NO_IDENTITY) {
            log('Run the reference-face script first, or drop --face for a photo of a thing.');
        }
        if (result.skipped === SKIP.BUDGET) {
            log('The daily image cap is spent. Raise dailyBudget.images on the persona, or wait for UTC midnight.');
        }
        process.exitCode = 1;
    }
};

if (require.main === module) {
    main().catch((err) => {
        console.error('[trigger] failed:', err.message);
        process.exit(1);
    });
}

module.exports = { main };
