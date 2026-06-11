import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow public dev tunnels (cloudflared / localtunnel) to reach the dev
    // server during phone testing. Safe for local dev; not used in production.
    allowedHosts: true,
  },
})
