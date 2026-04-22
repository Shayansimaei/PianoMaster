import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
 import { Application } from 'pixi.js';
import '@pixi/unsafe-eval'; // Import patch before creating application

const app = new Application();
export default defineConfig({
  plugins: [vue()],
 
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
 
  // GitHub Pages serves from /noteflow/ — must match your repo name exactly
  base: process.env.NODE_ENV === 'production' ? '/' : '/',
 
  server: {
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      overlay: true,
    },
  },
})