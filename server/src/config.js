import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Repo root, so `.env`, the DB file and the client build resolve the same way
// regardless of which directory the process was started from.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const DEV_SALT = 'dev-salt-change-me';
const nodeEnv = process.env.NODE_ENV || 'development';
const rawDbPath = process.env.DB_PATH || './data/pulse.db';

export const config = {
  root: ROOT,
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  dbPath: rawDbPath === ':memory:' ? rawDbPath : path.resolve(ROOT, rawDbPath),
  serverSalt: process.env.SERVER_SALT || DEV_SALT,
  clientDist: path.join(ROOT, 'client', 'dist'),
};

if (config.isProd && config.serverSalt === DEV_SALT) {
  console.warn('[config] SERVER_SALT is not set; using an insecure default. Set it in production.');
}
