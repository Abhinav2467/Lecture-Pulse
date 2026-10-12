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
import { formatClock, formatClockShort } from '../lib/format.js';

const AXIS = { stroke: 'var(--border-strong)', tick: { fill: 'var(--text-muted)', fontSize: 12 } };

export default function TimelineChart({ data = [], markers = [], height = 240 }) {
  if (data.length === 0) {
    return <p className="muted chart-empty">The timeline fills in as the session runs (one point every 15s).</p>;
  }

  return (
    <div className="chart" style={{ height }} role="img" aria-label="Confusion score over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatClockShort}
            minTickGap={48}
            {...AXIS}
          />
          <YAxis domain={[0, 100]} ticks={[0, 30, 60, 100]} {...AXIS} />
          <Tooltip
            labelFormatter={formatClock}
            formatter={(value) => [value, 'Confusion']}
            contentStyle={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
            }}
            labelStyle={{ color: 'var(--text-muted)' }}
            itemStyle={{ color: 'var(--text)' }}
          />
          {/* Level thresholds */}
          <ReferenceLine y={30} stroke="var(--level-some)" strokeDasharray="4 4" strokeOpacity={0.45} />
          <ReferenceLine y={60} stroke="var(--level-lost)" strokeDasharray="4 4" strokeOpacity={0.45} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          {markers.map((marker) => (
            <ReferenceDot
              key={marker.ts}
              x={marker.ts}
              y={marker.score}
              r={6}
              fill="var(--level-lost)"
              stroke="var(--bg)"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
