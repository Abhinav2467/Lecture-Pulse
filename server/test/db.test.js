import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/db.js';

const columns = (database) => database.pragma('table_info(sessions)').map((column) => column.name);

describe('migrate', () => {
  it('creates the full schema on an empty database', () => {
    const fresh = new Database(':memory:');
    migrate(fresh);
    expect(columns(fresh)).toEqual(expect.arrayContaining(['ended_at', 'peak_score', 'peak_at']));
  });

  it('adds the peak columns to a pre-existing sessions table without losing rows', () => {
    const old = new Database(':memory:');
    old.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
        host_token_hash TEXT NOT NULL, created_at INTEGER NOT NULL, ended_at INTEGER
      );
      INSERT INTO sessions VALUES ('s1', 'ABC234', 'Old lecture', 'hash', 1000, 2000);
    `);
    expect(columns(old)).not.toContain('peak_score');

    migrate(old);

    expect(columns(old)).toEqual(expect.arrayContaining(['peak_score', 'peak_at']));
    expect(old.prepare('SELECT * FROM sessions').all()).toEqual([
      {
        id: 's1', code: 'ABC234', title: 'Old lecture', host_token_hash: 'hash',
        created_at: 1000, ended_at: 2000, peak_score: null, peak_at: null,
      },
    ]);
  });

  it('is idempotent', () => {
    const database = new Database(':memory:');
    migrate(database);
    expect(() => migrate(database)).not.toThrow();
    expect(columns(database).filter((name) => name === 'peak_score')).toHaveLength(1);
  });
});
