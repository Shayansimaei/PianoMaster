import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Expose BASE_URL so createWebHistory(import.meta.env.BASE_URL) works
  base: '/',

  server: {
    port: 5173,
    // Force HMR to watch all files including deeply nested ones
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      overlay: true,
    },
  },
})
