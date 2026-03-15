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
    exclude: ['src/engine/parser-eval.test.ts', 'node_modules'],
    benchmark: {
      include: ['src/**/*.bench.ts'],
    },
  },
})
