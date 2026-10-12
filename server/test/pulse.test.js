import { describe, expect, it } from 'vitest';
import {
  WINDOW_MS,
  computePulse,
  latestPerClient,
  levelFor,
  pruneWindow,
} from '../src/lib/pulse.js';

const NOW = 1_000_000_000;
const tap = (clientHash, type, secondsAgo = 1) => ({ clientHash, type, ts: NOW - secondsAgo * 1000 });

describe('levelFor', () => {
  it('maps score bands to levels', () => {
    expect(levelFor(0)).toBe('Clear');
    expect(levelFor(29)).toBe('Clear');
    expect(levelFor(30)).toBe('Some confusion');
    expect(levelFor(59)).toBe('Some confusion');
    expect(levelFor(60)).toBe('Lost the room');
    expect(levelFor(100)).toBe('Lost the room');
  });
});

describe('computePulse', () => {
  it('returns a clear, zeroed pulse with no events', () => {
    expect(computePulse([], 0, NOW)).toEqual({
      score: 0,
      level: 'Clear',
      counts: { LOST: 0, TOO_FAST: 0, EXAMPLE: 0, GOT_IT: 0 },
      activeStudents: 0,
      ts: NOW,
    });
  });

  it('applies the weights and divides by active students', () => {
    const events = [tap('a', 'LOST'), tap('b', 'TOO_FAST'), tap('c', 'EXAMPLE'), tap('d', 'GOT_IT')];
    // (1.0 + 0.7 + 0.5 - 0.6) / 4 = 0.4
    const pulse = computePulse(events, 4, NOW);
    expect(pulse.score).toBe(40);
    expect(pulse.level).toBe('Some confusion');
    expect(pulse.counts).toEqual({ LOST: 1, TOO_FAST: 1, EXAMPLE: 1, GOT_IT: 1 });
  });

  it('treats silent students as not confused', () => {
    expect(computePulse([tap('a', 'LOST')], 10, NOW).score).toBe(10);
  });

  it('counts only the latest tap of each client', () => {
    const events = [tap('a', 'LOST', 30), tap('a', 'LOST', 20), tap('a', 'GOT_IT', 5), tap('b', 'LOST', 3)];
    const pulse = computePulse(events, 2, NOW);
    expect(pulse.counts).toEqual({ LOST: 1, TOO_FAST: 0, EXAMPLE: 0, GOT_IT: 1 });
    expect(pulse.score).toBe(20); // (1.0 - 0.6) / 2
  });

  it('ignores events outside the 120s window', () => {
    const events = [tap('a', 'LOST', 121), tap('b', 'LOST', 119)];
    const pulse = computePulse(events, 2, NOW);
    expect(pulse.counts.LOST).toBe(1);
    expect(pulse.score).toBe(50);
  });

  it('falls back to an older in-window tap only if it is the latest one', () => {
    // a's newest tap is in the window; the stale one must not resurface.
    const events = [tap('a', 'GOT_IT', 200), tap('a', 'LOST', 10)];
    expect(computePulse(events, 1, NOW).counts).toMatchObject({ LOST: 1, GOT_IT: 0 });
  });

  it('clamps to 0 when the room is happy', () => {
    const events = [tap('a', 'GOT_IT'), tap('b', 'GOT_IT')];
    expect(computePulse(events, 2, NOW).score).toBe(0);
  });

  it('clamps to 100 when taps outnumber connected students', () => {
    const events = [tap('a', 'LOST'), tap('b', 'LOST'), tap('c', 'LOST')];
    const pulse = computePulse(events, 1, NOW);
    expect(pulse.score).toBe(100);
    expect(pulse.level).toBe('Lost the room');
  });

  it('never divides by zero', () => {
    expect(computePulse([tap('a', 'EXAMPLE')], 0, NOW).score).toBe(50);
  });
});

describe('latestPerClient', () => {
  it('picks the newest event even if the buffer is out of order', () => {
    const latest = latestPerClient([tap('a', 'GOT_IT', 2), tap('a', 'LOST', 50)], NOW);
    expect(latest.get('a')).toBe('GOT_IT');
  });
});

describe('pruneWindow', () => {
  it('drops expired events and keeps the rest', () => {
    const events = [tap('a', 'LOST', 300), tap('b', 'LOST', 121), tap('c', 'LOST', 60), tap('d', 'LOST', 1)];
    expect(pruneWindow(events, NOW).map((e) => e.clientHash)).toEqual(['c', 'd']);
  });

  it('returns the same array when nothing expired', () => {
    const events = [tap('a', 'LOST', 5)];
    expect(pruneWindow(events, NOW)).toBe(events);
  });

  it('caps the buffer size', () => {
    const events = Array.from({ length: 10 }, (_, i) => tap(`c${i}`, 'LOST', 10 - i));
    expect(pruneWindow(events, NOW, WINDOW_MS, 4)).toHaveLength(4);
  });
});
