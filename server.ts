/**
 * CivicEye Full-Stack Server Entry Point
 * Mounts Express backend with /api routes and Vite middleware in development.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { apiRouter } from './src/backend/routes.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Body parser with 30mb limit for image uploads
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Mount CivicEye REST API
app.use('/api', apiRouter);

// Serve standalone prototype files
app.use('/prototype', express.static(path.resolve(process.cwd(), 'prototype')));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CivicEye Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  if (!isProd) {
    // Development mode: Mount Vite middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa'
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: Serve dist files
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      app.get('*', (_req, res) => {
        res.send('Production build not found. Run npm run build.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CivicEye] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[CivicEye] Failed to start server:', err);
  process.exit(1);
});
