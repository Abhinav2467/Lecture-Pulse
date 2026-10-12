import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    // Each test file runs in its own worker, so each gets a private in-memory DB.
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      SERVER_SALT: 'test-salt',
    },
  },
});
