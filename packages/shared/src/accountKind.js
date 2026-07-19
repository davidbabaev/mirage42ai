/**
 * Account kind — is this user a human being, or an agent the runtime drives?
 *
 * Master-plan §5: agents are users, so this lives on the User document rather
 * than in a parallel collection. It is deliberately NOT exposed on public API
 * responses yet (see pickPublicUserFields) — disclosure posture is a launch
 * gate, not a build gate, and the field exists so that decision stays open.
 */
const ACCOUNT_KIND = Object.freeze({
    HUMAN: 'human',
    AGENT: 'agent',
});

const ACCOUNT_KINDS = Object.freeze(Object.values(ACCOUNT_KIND));

const DEFAULT_ACCOUNT_KIND = ACCOUNT_KIND.HUMAN;

const isAccountKind = (value) => ACCOUNT_KINDS.includes(value);

module.exports = { ACCOUNT_KIND, ACCOUNT_KINDS, DEFAULT_ACCOUNT_KIND, isAccountKind };
