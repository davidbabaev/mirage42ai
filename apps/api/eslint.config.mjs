import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

// Shared rule tweaks for both source (CJS) and tests (ESM).
const rules = {
    // Express idioms keep otherwise-unused params: error handlers need the 4th
    // `next` arg to be recognized, and many `catch (err)` blocks intentionally
    // swallow. `ignoreRestSiblings` allows the `const { x, ...rest } = obj`
    // omit pattern (e.g. dropping maxAge before res.clearCookie). Genuinely
    // unused locals and imports are still flagged.
    'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],

    // Deferred, pre-existing stylistic noise (not bug-class) — kept off so the
    // suite is a clean, blocking gate without risky churn in this config commit:
    //  - no-useless-escape fires only inside the email/phone validation regexes,
    //    where blindly dropping an in-class `\-` can create an invalid range.
    //  - no-useless-catch flags the consistent `try { … } catch (e) { throw e }`
    //    scaffolding across the service layer.
    // Both are candidates for a focused follow-up cleanup.
    'no-useless-escape': 'off',
    'no-useless-catch': 'off',
};

export default defineConfig([
    globalIgnores(['node_modules', 'coverage']),
    {
        // Application source is CommonJS (require / module.exports) on Node.
        files: ['src/**/*.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: globals.node,
        },
        rules,
    },
    {
        // Test files are ESM (import) and run under Vitest on Node.
        files: ['tests/**/*.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
        rules,
    },
    {
        // Tooling configs (this file, vitest.config.mjs) are ESM on Node — lint
        // them too, otherwise they'd fall back to bare ESLint defaults.
        files: ['**/*.mjs'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
        rules,
    },
]);
