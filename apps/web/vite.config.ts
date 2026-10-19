import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig(({ mode }) => ({
  envDir: workspaceRoot,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.PORT || loadEnv(mode, workspaceRoot, 'PORT').PORT || '4000'}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-vendor': ['@reduxjs/toolkit', 'react-redux'],
          'ui-vendor': ['@radix-ui/react-dialog', 'sonner'],
        },
      },
    },
  },
}));
