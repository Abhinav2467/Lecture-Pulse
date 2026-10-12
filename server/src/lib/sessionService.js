import { EventEmitter } from 'node:events';
import { q } from '../db.js';
import { FEEDBACK_TYPES } from './pulse.js';
import {
  CODE_PATTERN,
  generateCode,
  generateHostToken,
  generateId,
  hashToken,
  safeEqual,
} from './security.js';

export const INACTIVITY_MS = 3 * 60 * 60 * 1000;

// Decouples REST/cron from Socket.IO: whoever ends a session emits here and
// the socket layer (if running) notifies the room and frees in-memory state.
export const bus = new EventEmitter();

export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function validateTitle(raw) {
  if (typeof raw !== 'string') return null;
  const title = raw.trim();
  return title.length >= 1 && title.length <= 80 ? title : null;
}

export function createSession(title) {
  const hostToken = generateHostToken();
  for (let attempt = 0; ; attempt++) {
    const code = generateCode();
    try {
      q.insertSession.run({
        id: generateId(),
        code,
        title,
        hostTokenHash: hashToken(hostToken),
        createdAt: Date.now(),
      });
      return { code, hostToken, title };
    } catch (err) {
      // Code collision (1 in ~10^9 per pair): just draw another one.
      if (err.code !== 'SQLITE_CONSTRAINT_UNIQUE' || attempt >= 5) throw err;
    }
  }
}

export const findSession = (code) => q.sessionByCode.get(code) ?? null;

export const publicSession = (session) => ({
  code: session.code,
  title: session.title,
  active: session.ended_at === null,
});

// Host auth: only the hash of the token is stored, compared in constant time.
export function verifyHost(session, token) {
  if (typeof token !== 'string' || token.length === 0) return false;
  return safeEqual(hashToken(token), session.host_token_hash);
}

export function endSession(session, now = Date.now()) {
  const { changes } = q.endSession.run(now, session.id);
  if (changes > 0) bus.emit('session:ended', { id: session.id, code: session.code, endedAt: now });
  return changes > 0;
}

export function endStaleSessions(now = Date.now()) {
  const stale = q.staleSessions.all(now - INACTIVITY_MS);
  for (const session of stale) endSession(session, now);
  return stale.length;
}

export function buildSummary(session, now = Date.now()) {
  const timeline = q.timeline.all(session.id);
  const totals = Object.fromEntries(FEEDBACK_TYPES.map((type) => [type, 0]));
  for (const row of q.feedbackTotals.all(session.id)) {
    if (row.type in totals) totals[row.type] = row.n;
  }

  let peak = null;
  let sum = 0;
  for (const point of timeline) {
    sum += point.score;
    if (!peak || point.score > peak.score) peak = point;
  }

  // The timeline is sampled every 15s and can miss a short spike; the peak stored
  // on the session row is tracked on every 2s pulse, so prefer it. The timeline
  // max is the fallback (older rows) and wins only if it is somehow higher.
  if (session.peak_score !== null && (!peak || session.peak_score >= peak.score)) {
    peak = { score: session.peak_score, ts: session.peak_at };
  }

  const topConfusionMoments = timeline
    .filter((point) => point.score > 0)
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, 3);

  return {
    code: session.code,
    title: session.title,
    active: session.ended_at === null,
    createdAt: session.created_at,
    endedAt: session.ended_at,
    durationMs: (session.ended_at ?? now) - session.created_at,
    uniqueParticipants: q.uniqueParticipants.get(session.id).n,
    totals,
    peakScore: peak?.score ?? 0,
    peakAt: peak?.ts ?? null,
    avgScore: timeline.length ? Math.round(sum / timeline.length) : 0,
    timeline,
    topConfusionMoments,
  };
}
