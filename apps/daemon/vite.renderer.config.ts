import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@aios/types': path.resolve(__dirname, '../../packages/types/src'),
      '@aios/config': path.resolve(__dirname, '../../packages/config/src'),
      '@aios/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@aios/core': path.resolve(__dirname, '../../packages/core/src'),
      '@aios/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});