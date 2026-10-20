import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // D206: e2e files share the singleton business_data row and truncate it in
    // setup, so running them in parallel would be flaky.
    fileParallelism: false,
  },
});
