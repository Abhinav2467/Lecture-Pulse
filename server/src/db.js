import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

if (config.dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
}

// Columns added after the first release. Existing databases get them through
// ALTER TABLE (nullable, so old rows stay valid); new ones through CREATE TABLE.
const ADDED_SESSION_COLUMNS = { peak_score: 'INTEGER', peak_at: 'INTEGER' };

// Creates the schema and brings an older database up to date. Safe to run on every boot.
export function migrate(database) {
  database.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    host_token_hash TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    peak_score      INTEGER,
    peak_at         INTEGER
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY,
    session_id  TEXT NOT NULL,
    type        TEXT NOT NULL,
    client_hash TEXT NOT NULL,
    ts          INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_feedback_session_ts ON feedback (session_id, ts);
  CREATE TABLE IF NOT EXISTS timeline (
    id         INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    ts         INTEGER NOT NULL,
    score      INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_timeline_session_ts ON timeline (session_id, ts);
`);

  const existing = new Set(database.pragma('table_info(sessions)').map((column) => column.name));
  for (const [name, type] of Object.entries(ADDED_SESSION_COLUMNS)) {
    if (!existing.has(name)) database.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`);
  }
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
migrate(db);

export const q = {
  insertSession: db.prepare(
    `INSERT INTO sessions (id, code, title, host_token_hash, created_at)
     VALUES (@id, @code, @title, @hostTokenHash, @createdAt)`,
  ),
  sessionByCode: db.prepare('SELECT * FROM sessions WHERE code = ?'),
  endSession: db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL'),
  // Only ever raises the stored peak, so a late or repeated write cannot lower it.
  raisePeak: db.prepare(
    `UPDATE sessions SET peak_score = @score, peak_at = @ts
     WHERE id = @id AND (peak_score IS NULL OR peak_score < @score)`,
  ),
  // Active sessions whose last activity (latest feedback, else creation) is older than the cutoff.
  staleSessions: db.prepare(
    `SELECT s.* FROM sessions s
     WHERE s.ended_at IS NULL
       AND COALESCE((SELECT MAX(f.ts) FROM feedback f WHERE f.session_id = s.id), s.created_at) < ?`,
  ),
  insertFeedback: db.prepare(
    'INSERT INTO feedback (session_id, type, client_hash, ts) VALUES (?, ?, ?, ?)',
  ),
  recentFeedback: db.prepare(
    `SELECT type, client_hash AS clientHash, ts FROM feedback
     WHERE session_id = ? AND ts > ? ORDER BY ts`,
  ),
  feedbackTotals: db.prepare(
    'SELECT type, COUNT(*) AS n FROM feedback WHERE session_id = ? GROUP BY type',
  ),
  uniqueParticipants: db.prepare(
    'SELECT COUNT(DISTINCT client_hash) AS n FROM feedback WHERE session_id = ?',
  ),
  insertTimeline: db.prepare('INSERT INTO timeline (session_id, ts, score) VALUES (?, ?, ?)'),
  timeline: db.prepare('SELECT ts, score FROM timeline WHERE session_id = ? ORDER BY ts'),
};
