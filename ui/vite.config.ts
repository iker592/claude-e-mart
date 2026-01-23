import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],

    // Define environment variables to be exposed to the app
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || ''),
    },

    // Build configuration for production
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // Optimize chunk size
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            markdown: ['react-markdown', 'remark-gfm'],
          },
        },
      },
    },

    // Dev server configuration
    server: {
      port: 5173,
      proxy: {
        // Proxy API requests to backend during development
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
        '/health': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
