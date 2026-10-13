import os from 'node:os';
import { Router } from 'express';
import { config } from '../config.js';

export const healthRouter = Router();

// First non-loopback IPv4 of this machine. Read per request, so it follows the
// laptop from one Wi-Fi or hotspot to another without a restart.
function lanAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    const found = addresses?.find((a) => a.family === 'IPv4' && !a.internal);
    if (found) return found.address;
  }
  return null;
}

healthRouter.get('/', (req, res) => {
  // Development only: lets a dashboard opened on localhost build a join link phones can reach.
  res.json(config.isProd ? { ok: true } : { ok: true, lan: lanAddress() });
});
