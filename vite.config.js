import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': path.resolve('./src')
    }
  },
  server: {
    port: 5173,
    open: true
  }
});
