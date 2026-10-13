import { describe, expect, it } from 'vitest';
import { rankTopics, topicInsight, topicStats } from '../src/lib/insights.js';

const topic = (label, avgScore, startedAt = 0) => ({ label, avgScore, startedAt });

describe('topicStats', () => {
  const topics = [
    { id: 1, label: 'Intro', startedAt: 0, endedAt: 60_000 },
    { id: 2, label: 'Arrays', startedAt: 60_000, endedAt: 120_000 },
    { id: 3, label: 'Recursion', startedAt: 120_000, endedAt: null },
  ];
  const timeline = [
    { ts: 15_000, score: 10 }, { ts: 45_000, score: 20 },
    { ts: 60_000, score: 30 }, { ts: 90_000, score: 15 },
    { ts: 130_000, score: 80 }, { ts: 170_000, score: 60 },
  ];
  const stats = topicStats(topics, timeline, (t) => t.id * 10, 180_000);

  it('assigns each sample to the topic whose [start, end) contains it', () => {
    expect(stats.map((t) => [t.label, t.avgScore, t.peakScore])).toEqual([
      ['Intro', 15, 20],
      ['Arrays', 22.5, 30],
      ['Recursion', 70, 80],
    ]);
  });

  it('uses the session end for a topic that is still open', () => {
    expect(stats.map((t) => t.durationMs)).toEqual([60_000, 60_000, 60_000]);
    expect(stats[2].endedAt).toBeNull();
  });

  it('passes taps through and reports null stats for a topic without samples', () => {
    expect(stats.map((t) => t.taps)).toEqual([10, 20, 30]);
    const [empty] = topicStats([{ id: 9, label: 'Blip', startedAt: 1, endedAt: 2 }], timeline, () => 0, 3);
    expect(empty).toMatchObject({ avgScore: null, peakScore: null, durationMs: 1 });
  });
});

describe('rankTopics', () => {
  it('sorts by average score, most confusing first, with no-data topics last', () => {
    const ranked = rankTopics([topic('A', 10, 1), topic('B', null, 2), topic('C', 55, 3), topic('D', 10, 0)]);
    expect(ranked.map((t) => t.label)).toEqual(['C', 'D', 'A', 'B']);
  });
});

describe('topicInsight', () => {
  const insight = (...topics) => topicInsight(rankTopics(topics));

  it('quotes a ratio between the most and least confusing topics', () => {
    expect(insight(topic('Arrays', 12), topic('Recursion', 37.2))).toBe(
      'Recursion was 3.1× more confusing than Arrays.',
    );
  });

  it('needs at least two topics with data', () => {
    expect(insight()).toBeNull();
    expect(insight(topic('Only', 50))).toBeNull();
    expect(insight(topic('Only', 50), topic('Empty', null))).toBeNull();
  });

  it('never divides by zero or a near-zero average', () => {
    const zero = insight(topic('Recursion', 40), topic('Intro', 0));
    const tiny = insight(topic('Recursion', 40), topic('Intro', 0.4));
    for (const text of [zero, tiny]) {
      expect(text).toBe('Recursion was the most confusing topic (avg 40), while Intro stayed clear.');
      expect(text).not.toMatch(/×|Infinity|NaN/);
    }
  });

  it('handles an entirely clear session', () => {
    expect(insight(topic('A', 0), topic('B', 2))).toBe('Every topic stayed clear.');
  });

  it('does not overstate a small difference', () => {
    expect(insight(topic('A', 30), topic('B', 33))).toBe('Confusion was similar across topics (avg 30–33).');
  });
});
