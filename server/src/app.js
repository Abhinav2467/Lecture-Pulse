import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { sessionsRouter } from './routes/sessions.js';

export function createApp({ createLimit = 10 } = {}) {
  const app = express();

  // Behind Render's proxy the client IP is in X-Forwarded-For (needed for rate limiting).
  if (config.isProd) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'", 'ws:', 'wss:'],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '10kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/sessions', sessionsRouter({ createLimit }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Production: one service serves both the API and the built SPA.
  if (config.isProd && fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
