import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // WxtVitest wires up WXT auto-imports, path aliases, and an in-memory `browser` API (fake-browser).
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
    restoreMocks: true,
    // Process CSS so `*.css?raw` imports return the real stylesheet. UI tests load the shipped CSS to assert what
    // is actually displayed (regression: [hidden] was overridden by component CSS, T-011).
    css: { include: [/.+/] },
  },
});
