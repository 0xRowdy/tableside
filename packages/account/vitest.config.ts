import { defineConfig } from 'vitest/config';

// Seam 2 scenarios against the local Supabase stack (`supabase start` at the
// repository root). Run with `pnpm test:accounts`.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    // Scenarios share one stack; Auth's per-IP rate limits make parallel files flaky.
    fileParallelism: false,
  },
});
