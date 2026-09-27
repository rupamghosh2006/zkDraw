import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Component/DOM tests would use 'jsdom'; all current tests are pure-logic
    // and run fine in Node. Switch to 'jsdom' when @testing-library/react is added.
    testTimeout: 10000,
    include: ['tests/**/*.test.ts'],
  },
});
