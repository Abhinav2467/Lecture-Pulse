import { POLL_CHOICES } from '../lib/constants.js';

// Horizontal result bars; widths animate as votes arrive.
export default function PollBars({ counts = {}, total = 0 }) {
  return (
    <div className="poll-bars">
      {POLL_CHOICES.map(({ key, emoji, label }) => {
        const n = counts[key] ?? 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        return (
          <div className="poll-bar" key={key}>
            <span className="poll-bar-emoji" aria-hidden="true">{emoji}</span>
            <span className="poll-bar-name">{label}</span>
            <div className="poll-bar-track">
              <div className="poll-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="poll-bar-count">
              <strong>{n}</strong> · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
