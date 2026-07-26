/**
 * The durable budget ledger, reached over the ADMIN API (§6/§11).
 *
 * Unlike everything in actions.js, these take the RUNTIME (admin) session, not
 * the agent's own: the budget endpoints are an admin surface, the same one the
 * roster lives behind, and the agent's own credential is deliberately not admin.
 * This is not the agent "doing" something as a user — it is the runtime keeping
 * its own cost ledger, which is why it is a separate module.
 *
 * The worker has no database access; this is the only way its in-memory ledger
 * reaches durable storage.
 */

/** Reads one UTC day's spend for every agent, to hydrate the ledger on boot. */
const fetchBudget = async (runtimeSession, day) => {
    const body = await runtimeSession.request(
        `/agents/admin/budget?day=${encodeURIComponent(day)}`
    );
    return body?.budgets || [];
};

/**
 * Writes through one unit of spend. Shaped to match BudgetLedger's persist
 * callback: it is handed { agentId, kind, amount, day } and turns that into the
 * one POST the ledger's write-through needs.
 */
const persistBudget = (runtimeSession, { agentId, kind, amount, day }) =>
    runtimeSession.request(`/agents/admin/budget/${encodeURIComponent(agentId)}`, {
        method: 'POST',
        body: { kind, amount, day },
    });

module.exports = { fetchBudget, persistBudget };
