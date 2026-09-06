import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Resolve shared schemas location: handles local dev host, Docker container, and local mirror
const sharedDir = fs.existsSync(path.resolve(__dirname, '../shared'))
  ? path.resolve(__dirname, '../shared')
  : fs.existsSync('/shared')
  ? '/shared'
  : path.resolve(__dirname, 'shared');

// Determine API proxy target: inside Docker network use service name 'api', on host use localhost:5000
const isDocker = fs.existsSync('/.dockerenv') || fs.existsSync('/shared');
const apiTarget = process.env.API_TARGET || (isDocker ? 'http://api:5000' : 'http://localhost:5002');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'models-case-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && req.url.startsWith('/models/')) {
            req.url = req.url.replace(/^\/models\//, '/Models/');
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: 'decimal.js', replacement: path.resolve(__dirname, 'node_modules/decimal.js') },
      { find: 'zod', replacement: path.resolve(__dirname, 'node_modules/zod') },
      { find: /^(\.\.\/)+shared/, replacement: sharedDir },
      { find: '@shared', replacement: sharedDir },
      { find: 'shared', replacement: sharedDir },
    ],
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    fs: {
      allow: [
        __dirname,
        path.resolve(__dirname, '..'),
        '/shared',
        sharedDir,
      ],
    },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiTarget,
        ws: true,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },

  },
});
