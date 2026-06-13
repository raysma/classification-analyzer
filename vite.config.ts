import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_APP_SHA': JSON.stringify(process.env['VERCEL_GIT_COMMIT_SHA'] ?? null),
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'recharts', test: /recharts/ },
            { name: 'query', test: /@tanstack/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
  },
})
