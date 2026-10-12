// Confusion score: pure functions only (no I/O, no clocks unless passed in),
// so the maths can be unit-tested in isolation.

export const WINDOW_MS = 120_000; // rolling window of feedback that counts
export const COOLDOWN_MS = 8_000; // min gap between taps per client per session
export const MAX_EVENTS = 5_000; // hard cap on the per-session in-memory buffer

export const WEIGHTS = Object.freeze({
  LOST: 1.0,
  TOO_FAST: 0.7,
  EXAMPLE: 0.5,
  GOT_IT: -0.6,
});

export const FEEDBACK_TYPES = Object.freeze(Object.keys(WEIGHTS));

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function levelFor(score) {
  if (score >= 60) return 'Lost the room';
  if (score >= 30) return 'Some confusion';
  return 'Clear';
}

export function emptyCounts() {
  return Object.fromEntries(FEEDBACK_TYPES.map((type) => [type, 0]));
}

/**
 * Drops events that fell out of the rolling window (and anything beyond the
 * buffer cap). `events` must be in chronological order, which holds because
 * they are only ever appended with the current time.
 */
export function pruneWindow(events, now, windowMs = WINDOW_MS, max = MAX_EVENTS) {
  const cutoff = now - windowMs;
  let start = 0;
  while (start < events.length && events[start].ts <= cutoff) start++;
  start = Math.max(start, events.length - max);
  return start === 0 ? events : events.slice(start);
}

/**
 * Reduces the window to one vote per client: their most recent tap.
 * Without this a single student could spam "LOST" and dominate the score.
 * Returns Map<clientHash, type>.
 */
export function latestPerClient(events, now, windowMs = WINDOW_MS) {
  const cutoff = now - windowMs;
  const latest = new Map();
  for (const event of events) {
    if (event.ts <= cutoff || event.ts > now) continue;
    const seen = latest.get(event.clientHash);
    if (!seen || event.ts >= seen.ts) latest.set(event.clientHash, event);
  }
  return new Map([...latest].map(([clientHash, event]) => [clientHash, event.type]));
}

/**
 * score = clamp(round(100 * Σ weight(latest tap of each client) / max(activeStudents, 1)), 0, 100)
 *
 * Dividing by *connected* students (not by voters) means silence counts as
 * "fine": 3 lost students in a room of 60 is a blip, 3 of 4 is a problem.
 * GOT_IT has a negative weight, so it actively pulls the score down; the
 * clamp keeps a happy room at 0 rather than going negative.
 */
export function computePulse(events, activeStudents, now = Date.now()) {
  const counts = emptyCounts();
  let weightSum = 0;
  for (const type of latestPerClient(events, now).values()) {
    if (!(type in WEIGHTS)) continue;
    counts[type] += 1;
    weightSum += WEIGHTS[type];
  }
  const score = clamp(Math.round((100 * weightSum) / Math.max(activeStudents, 1)), 0, 100);
  return { score, level: levelFor(score), counts, activeStudents, ts: now };
}
