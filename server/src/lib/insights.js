// Topic analytics for the summary. Pure functions.

const NEAR_ZERO = 5; // an average below this is "clear": never use it as a denominator
const SIMILAR_RATIO = 1.2;

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Adds per-topic stats, in chronological order.
 * topics: [{id, label, startedAt, endedAt}], timeline: [{ts, score}],
 * tapsFor(topic, endTs) -> number, endTs: when the session ended (or "now").
 * avgScore/peakScore are null when no timeline sample fell inside the topic.
 */
export function topicStats(topics, timeline, tapsFor, endTs) {
  return topics.map((topic) => {
    const end = topic.endedAt ?? endTs;
    let sum = 0;
    let n = 0;
    let peak = null;
    for (const point of timeline) {
      if (point.ts < topic.startedAt || point.ts >= end) continue;
      sum += point.score;
      n += 1;
      if (peak === null || point.score > peak) peak = point.score;
    }
    return {
      id: topic.id,
      label: topic.label,
      startedAt: topic.startedAt,
      endedAt: topic.endedAt,
      durationMs: Math.max(0, end - topic.startedAt),
      avgScore: n > 0 ? round1(sum / n) : null,
      peakScore: peak,
      taps: tapsFor(topic, end),
    };
  });
}

// Most confusing first; topics without data go last.
export function rankTopics(stats) {
  return [...stats].sort((a, b) => {
    if (a.avgScore === null || b.avgScore === null) {
      if (a.avgScore === b.avgScore) return a.startedAt - b.startedAt;
      return a.avgScore === null ? 1 : -1;
    }
    return b.avgScore - a.avgScore || a.startedAt - b.startedAt;
  });
}

/**
 * One-line headline comparing the most and least confusing topics.
 * Null unless at least two topics have data. A ratio is only quoted when the
 * denominator is meaningfully above zero; "38 vs 0.4" would otherwise read as
 * "95x more confusing", which is noise, not insight.
 */
export function topicInsight(ranking) {
  const withData = ranking.filter((topic) => topic.avgScore !== null);
  if (withData.length < 2) return null;
  const top = withData[0];
  const low = withData.at(-1);

  if (top.avgScore < NEAR_ZERO) return 'Every topic stayed clear.';
  if (low.avgScore < NEAR_ZERO) {
    return `${top.label} was the most confusing topic (avg ${top.avgScore}), while ${low.label} stayed clear.`;
  }
  const ratio = top.avgScore / low.avgScore;
  if (ratio < SIMILAR_RATIO) return `Confusion was similar across topics (avg ${low.avgScore}–${top.avgScore}).`;
  return `${top.label} was ${ratio.toFixed(1)}× more confusing than ${low.label}.`;
}
