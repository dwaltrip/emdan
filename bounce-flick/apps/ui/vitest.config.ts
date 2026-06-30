import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Standalone from vite.config.ts on purpose: the React + react-compiler babel
// plugins are irrelevant to the headless physics/logic tests, so we skip them
// and only re-declare the @shared alias the game modules need.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
})
