import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'testing/**/*',
        'packages/evaluation/**/*',
        'packages/benchmarks/**/*'
      ],
      thresholds: {
        lines: 95,
        functions: 98,
        branches: 90,
        statements: 95
      }
    }
  }
})
