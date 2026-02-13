import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'api/**/*.test.ts', '*.test.ts'],
    benchmark: {
      include: ['src/**/*.bench.ts'],
    },
  },
})
