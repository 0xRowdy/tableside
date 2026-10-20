import { defineConfig } from 'vitest/config';

// Node-side unit tests. The engine suite runs through the cross-runtime harness
// and the app through jest-expo; neither is collected here.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
});
