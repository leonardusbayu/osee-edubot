import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Generate source maps for production deployments so error stacks
    // (e.g. React #300 in TestRunner) point to the actual source file +
    // line instead of the minified column. The maps are uploaded to Pages
    // but NOT referenced by index.html — they only help when devs open
    // them in DevTools manually for the current error report. Keeps prod
    // bundle payload unchanged for end users.
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable vendor chunk → long-lived browser cache across deploys
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
