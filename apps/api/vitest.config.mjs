import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        testTimeout: 30_000,
        hookTimeout: 120_000,
        include: ['tests/**/*.test.js'],
    },
    pool: 'forks',
    poolOptions: {
        forks: { singleFork: true },
    },
});
