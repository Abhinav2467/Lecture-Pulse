import { useId } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { levelColor, levelForScore } from '../lib/constants.js';
import { formatClock, formatClockShort } from '../lib/format.js';

const AXIS = { stroke: 'var(--border)', tick: { fill: 'var(--muted)', fontSize: 11.5 }, tickLine: false };

/**
 * Confusion over time. Grid and axes are monochrome; only the line carries
 * colour, split at the level thresholds (30 / 60). Topics are labelled
 * vertical markers; `markers` are highlighted points (peaks); `cursor` is the
 * replay position.
 */
export default function TimelineChart({ data = [], topics = [], markers = [], cursor, height = 240 }) {
  const gradientId = `line-${useId().replace(/:/g, '')}`;

  if (data.length === 0) {
    return <p className="chart-empty muted">The timeline fills in as the session runs (one point every 15s).</p>;
  }

  const scores = data.map((point) => point.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  // A gradient is mapped onto the line's bounding box, and a flat line has a
  // box of zero height (the gradient would not paint), so use a solid colour.
  const flat = max === min;
  const offset = (value) => `${Math.min(1, Math.max(0, (max - value) / (max - min))) * 100}%`;

  const start = Math.min(data[0].ts, topics[0]?.startedAt ?? Infinity);
  const end = data.at(-1).ts;
  // Short sessions need seconds on the axis, or every tick reads the same minute.
  const tickFormat = end - start < 10 * 60_000 ? formatClock : formatClockShort;

  return (
    <div className="chart" style={{ height }} role="img" aria-label="Confusion score over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 18, right: 14, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={offset(60)} style={{ stopColor: 'var(--level-lost)' }} />
              <stop offset={offset(60)} style={{ stopColor: 'var(--level-some)' }} />
              <stop offset={offset(30)} style={{ stopColor: 'var(--level-some)' }} />
              <stop offset={offset(30)} style={{ stopColor: 'var(--level-clear)' }} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border-soft)" strokeDasharray="2 5" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={[start, end]}
            tickFormatter={tickFormat}
            minTickGap={72}
            {...AXIS}
          />
          <YAxis domain={[0, 100]} ticks={[0, 30, 60, 100]} axisLine={false} {...AXIS} />
          <Tooltip
            labelFormatter={formatClock}
            formatter={(value) => [value, 'Confusion']}
            cursor={{ stroke: 'var(--border)' }}
            contentStyle={{
              background: 'rgba(12,12,12,0.92)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12.5,
            }}
            labelStyle={{ color: 'var(--muted)' }}
            itemStyle={{ color: 'var(--text)' }}
          />
          {topics.map((topic) => (
            <ReferenceLine
              key={topic.id}
              x={Math.max(topic.startedAt, start)}
              stroke="var(--border)"
              strokeDasharray="3 4"
              label={{ value: topic.label, position: 'insideTopLeft', fill: 'var(--stat)', fontSize: 11, offset: 6 }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="score"
            stroke={flat ? levelColor(levelForScore(max)) : `url(#${gradientId})`}
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4, fill: '#fff', stroke: 'none' }}
            isAnimationActive={false}
            style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.22))' }}
          />
          {markers.map((marker) => (
            <ReferenceDot
              key={marker.ts}
              x={marker.ts}
              y={marker.score}
              r={5}
              fill={levelColor(levelForScore(marker.score))}
              stroke="var(--bg)"
              strokeWidth={2}
            />
          ))}
          {cursor !== undefined && <ReferenceLine x={cursor} stroke="var(--text)" strokeWidth={1.2} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
