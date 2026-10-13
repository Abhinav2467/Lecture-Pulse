import { useEffect, useMemo, useRef, useState } from 'react';
import { levelForScore } from '../lib/constants.js';
import { formatClock, formatDuration } from '../lib/format.js';
import Gauge from './Gauge.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import PillButton from './ui/PillButton.jsx';

const SPEEDS = [1, 4, 16];

// Linear interpolation between the two timeline samples around `t`.
export function scoreAt(timeline, t) {
  if (timeline.length === 0) return 0;
  if (t <= timeline[0].ts) return timeline[0].score;
  const last = timeline.at(-1);
  if (t >= last.ts) return last.score;
  let i = 1;
  while (timeline[i].ts < t) i += 1;
  const a = timeline[i - 1];
  const b = timeline[i];
  return a.score + ((b.score - a.score) * (t - a.ts)) / (b.ts - a.ts || 1);
}

export const topicAt = (topics, t) => topics.findLast((topic) => topic.startedAt <= t) ?? topics[0] ?? null;

/**
 * Client-side replay of a finished session: scrub or play through the
 * timeline and watch the gauge, level and topic follow. 1x is real time.
 * `onSeek(t)` lets the parent draw a cursor on its chart.
 */
export default function ReplayPlayer({ timeline, topics, onSeek }) {
  const start = timeline[0].ts;
  const end = timeline.at(-1).ts;
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!playing) return undefined;
    let frame = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last;
      last = now;
      setT((prev) => {
        const next = Math.min(end, prev + dt * speedRef.current);
        if (next >= end) setPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, end]);

  useEffect(() => {
    onSeek?.(t > start ? t : undefined); // no cursor on the chart until the replay has moved
  }, [t, start, onSeek]);

  const score = useMemo(() => scoreAt(timeline, t), [timeline, t]);
  const topic = topicAt(topics, t);
  const fill = end > start ? ((t - start) / (end - start)) * 100 : 0;

  function toggle() {
    if (!playing && t >= end) setT(start); // play again from the top
    setPlaying((value) => !value);
  }

  return (
    <div className="replay">
      <Gauge score={score} level={levelForScore(Math.round(score))} size="sm" />
      <div>
        <div className="replay-meta">
          <em>{topic?.label ?? 'Session'}</em>
          <span>
            {formatClock(t)} · {formatDuration(t - start)} / {formatDuration(end - start)}
          </span>
        </div>
        <label htmlFor="scrubber" className="sr-only">Replay position</label>
        <input
          id="scrubber"
          className="scrubber"
          type="range"
          min={start}
          max={end}
          step={250}
          value={t}
          style={{ '--fill': `${fill}%` }}
          aria-valuetext={formatClock(t)}
          onChange={(event) => {
            setPlaying(false);
            setT(Number(event.target.value));
          }}
        />
        <div className="replay-controls">
          <Button size="sm" onClick={toggle} aria-label={playing ? 'Pause replay' : 'Play replay'}>
            <Icon name={playing ? 'pause' : 'play'} size={14} /> {playing ? 'Pause' : 'Play'}
          </Button>
          <span className="spacer" />
          <span className="hint">Speed</span>
          {SPEEDS.map((value) => (
            <PillButton key={value} size="sm" active={speed === value} onClick={() => setSpeed(value)}>
              {value}×
            </PillButton>
          ))}
        </div>
      </div>
    </div>
  );
}
