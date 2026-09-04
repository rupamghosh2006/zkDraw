import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm(), react(), tailwindcss()],
  build: {
    target: 'esnext',
  },
  // Treat binary ZK prover/verifier/zkir files as raw static assets (no transform)
  assetsInclude: ['**/*.prover', '**/*.verifier', '**/*.zkir', '**/*.bzkir'],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
