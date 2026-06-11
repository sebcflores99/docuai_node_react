import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { InlineConfig } from 'vitest/node'

// Vitest extends Vite's config with a `test` field at runtime. Vite 8's own
// config type doesn't know about it, so we attach it via a typed spread.
const test: InlineConfig = {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  css: false,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  ...{ test },
})
