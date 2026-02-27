import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [path.resolve(__dirname, './setup.js')],
    fileParallelism: false,
    include: ['**/*.test.js'],
    env: {
      NODE_ENV: 'test'
    },
    testTimeout: 120000,
    hookTimeout: 120000
  },
});
