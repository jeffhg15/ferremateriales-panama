// Carga .env (sin dependencias) y expone la configuración del servidor.
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.resolve('.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const config = {
  port: Number(process.env.PORT || 5173),
  dataDir: path.resolve(process.env.DATA_DIR || 'data'),
  get dbFile() { return path.join(this.dataDir, 'ferremateriales.db'); },
  get uploadDir() { return path.join(this.dataDir, 'uploads'); },
  demoMode: (process.env.DEMO_MODE ?? 'true') === 'true',
  secureCookies: process.env.SECURE_COOKIES === 'true',
};
