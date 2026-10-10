import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vendor code changes far less often than app code. Splitting it into its own
// chunks means a normal deploy only invalidates the small app chunk — the
// framework + Supabase bundles stay in the browser cache (see public/_headers).
function vendorChunk(id) {
  if (!id.includes('node_modules')) {
    return undefined
  }

  if (/node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser|@tanstack)[\\/]/.test(id)) {
    return 'vendor-react'
  }

  return 'vendor-supabase'
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow public dev tunnels (cloudflared / localtunnel) to reach the dev
    // server during phone testing. Safe for local dev; not used in production.
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
