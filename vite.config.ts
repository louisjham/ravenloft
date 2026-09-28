import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl()
  ],
  server: {
    port: 3000,
    host: '0.0.0.0', // Listen on all network interfaces for Quest 2 headset
    strictPort: true,
    open: false
  }
})
