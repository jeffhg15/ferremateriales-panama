import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { config } from './config.js';
import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp } from './app.js';

const dev = process.argv.includes('--dev');
const db = openDb(config.dbFile);
if (!db.prepare('SELECT COUNT(*) AS n FROM products').get().n) {
  if (config.demoMode) seed(db, { dataDir: config.dataDir });
  else console.warn('[aviso] Base de datos vacía y DEMO_MODE=false. Ejecute "npm run seed" o cargue sus datos.');
}

const app = createApp(db, { demoMode: config.demoMode, secureCookies: config.secureCookies, dataDir: config.dataDir, uploadDir: config.uploadDir });

if (dev) {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const dist = path.resolve('dist');
  if (!fs.existsSync(dist)) { console.error('Falta dist/. Ejecute "npm run build" primero.'); process.exit(1); }
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(config.port, () => {
  console.log(`Ferremateriales Panamá en http://localhost:${config.port} (${dev ? 'desarrollo' : 'producción'}${config.demoMode ? ', MODO DEMOSTRACIÓN' : ''})`);
});
