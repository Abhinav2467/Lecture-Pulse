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
  CREATE TABLE IF NOT EXISTS topics (
    id         INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    label      TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_topics_session ON topics (session_id, started_at);
  CREATE TABLE IF NOT EXISTS alerts (
    id            INTEGER PRIMARY KEY,
    session_id    TEXT NOT NULL,
    started_at    INTEGER NOT NULL,
    ended_at      INTEGER,
    dominant_type TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_alerts_session ON alerts (session_id, started_at);
  CREATE TABLE IF NOT EXISTS polls (
    id         INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    question   TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    closed_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_polls_session ON polls (session_id, started_at);
  CREATE TABLE IF NOT EXISTS poll_votes (
    id          INTEGER PRIMARY KEY,
    poll_id     INTEGER NOT NULL,
    client_hash TEXT NOT NULL,
    choice      TEXT NOT NULL,
    ts          INTEGER NOT NULL,
    UNIQUE (poll_id, client_hash)
  );
  CREATE TABLE IF NOT EXISTS reactions (
    session_id TEXT NOT NULL,
    emoji      TEXT NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, emoji)
  );
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
  feedbackCountBetween: db.prepare(
    'SELECT COUNT(*) AS n FROM feedback WHERE session_id = ? AND ts >= ? AND ts < ?',
  ),

  insertTopic: db.prepare('INSERT INTO topics (session_id, label, started_at) VALUES (?, ?, ?)'),
  closeOpenTopics: db.prepare('UPDATE topics SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL'),
  openTopic: db.prepare(
    `SELECT id, label, started_at AS startedAt FROM topics
     WHERE session_id = ? AND ended_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1`,
  ),
  topics: db.prepare(
    `SELECT id, label, started_at AS startedAt, ended_at AS endedAt FROM topics
     WHERE session_id = ? ORDER BY started_at, id`,
  ),

  insertAlert: db.prepare('INSERT INTO alerts (session_id, started_at, dominant_type) VALUES (?, ?, ?)'),
  closeAlert: db.prepare('UPDATE alerts SET ended_at = ? WHERE id = ? AND ended_at IS NULL'),
  closeOpenAlerts: db.prepare('UPDATE alerts SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL'),
  openAlert: db.prepare(
    `SELECT id, started_at AS startedAt, dominant_type AS dominantType FROM alerts
     WHERE session_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1`,
  ),
  alerts: db.prepare(
    `SELECT started_at AS startedAt, ended_at AS endedAt, dominant_type AS dominantType FROM alerts
     WHERE session_id = ? ORDER BY started_at, id`,
  ),

  insertPoll: db.prepare('INSERT INTO polls (session_id, question, started_at) VALUES (?, ?, ?)'),
  closePoll: db.prepare('UPDATE polls SET closed_at = ? WHERE id = ? AND closed_at IS NULL'),
  closeOpenPolls: db.prepare('UPDATE polls SET closed_at = ? WHERE session_id = ? AND closed_at IS NULL'),
  polls: db.prepare(
    `SELECT id, question, started_at AS startedAt, closed_at AS closedAt FROM polls
     WHERE session_id = ? ORDER BY started_at, id`,
  ),
  insertVote: db.prepare('INSERT INTO poll_votes (poll_id, client_hash, choice, ts) VALUES (?, ?, ?, ?)'),
  hasVoted: db.prepare('SELECT 1 AS voted FROM poll_votes WHERE poll_id = ? AND client_hash = ?'),
  pollTallies: db.prepare(
    `SELECT v.poll_id AS pollId, v.choice, COUNT(*) AS n FROM poll_votes v
     JOIN polls p ON p.id = v.poll_id WHERE p.session_id = ? GROUP BY v.poll_id, v.choice`,
  ),

  addReaction: db.prepare(
    `INSERT INTO reactions (session_id, emoji, count) VALUES (?, ?, 1)
     ON CONFLICT (session_id, emoji) DO UPDATE SET count = count + 1`,
  ),
  reactions: db.prepare('SELECT emoji, count FROM reactions WHERE session_id = ?'),
};
