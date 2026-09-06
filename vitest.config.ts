import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'api/**/*.test.ts', 'scripts/**/*.test.ts', '*.test.ts'],
    exclude: ['node_modules'],
    benchmark: {
      include: ['src/**/*.bench.ts'],
    },
  },
})
