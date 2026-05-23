import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/',
      server: {
        port: 3010,
        host: '0.0.0.0',
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'esbuild',
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
              'postprocessing-vendor': ['@react-three/postprocessing', 'postprocessing'],
            }
          }
        }
      },
      plugins: [react()],
      // NOTE: GEMINI_API_KEY define is removed because it would bundle the key
      // into the client-side JS, causing a security leak.
      // If Gemini AI features are needed in the future, route calls through a
      // backend proxy (e.g. Vercel Serverless Function in api/) instead of
      // exposing API keys in the frontend bundle.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
