import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  buildSummary,
  createSession,
  endSession,
  findSession,
  normalizeCode,
  publicSession,
  validateTitle,
  verifyHost,
} from '../lib/sessionService.js';

export function sessionsRouter({ createLimit = 10 } = {}) {
  const router = Router();

  const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: createLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sessions created from this address. Try again later.' },
  });

  const loadSession = (req, res, next) => {
    const code = normalizeCode(req.params.code);
    const session = code && findSession(code);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    req.session = session;
    next();
  };

  // Host-only routes: the secret travels in a header, never in the URL.
  const requireHost = (req, res, next) => {
    if (!verifyHost(req.session, req.get('x-host-token'))) {
      return res.status(401).json({ error: 'Invalid or missing host token' });
    }
    next();
  };

  router.post('/', createLimiter, (req, res) => {
    const title = validateTitle(req.body?.title);
    if (!title) return res.status(400).json({ error: 'Title must be 1-80 characters' });
    res.status(201).json(createSession(title));
  });

  router.get('/:code', loadSession, (req, res) => {
    res.json(publicSession(req.session));
  });

  router.post('/:code/end', loadSession, requireHost, (req, res) => {
    endSession(req.session); // idempotent: ending twice is still ok
    res.json({ ok: true });
  });

  router.get('/:code/summary', loadSession, requireHost, (req, res) => {
    res.json(buildSummary(req.session));
  });

  return router;
}
