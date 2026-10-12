import { FEEDBACK } from '../lib/constants.js';

// Stacked bar of all taps in the session, by type.
export default function TotalsBar({ totals = {} }) {
  const sum = FEEDBACK.reduce((acc, { type }) => acc + (totals[type] ?? 0), 0);

  return (
    <div className="totals">
      <div className="totals__bar" aria-hidden="true">
        {sum > 0 &&
          FEEDBACK.filter(({ type }) => totals[type] > 0).map(({ type, color }) => (
            <div
              key={type}
              className="totals__seg"
              style={{ '--fb-color': color, width: `${(totals[type] / sum) * 100}%` }}
            />
          ))}
      </div>
      <ul className="totals__legend">
        {FEEDBACK.map(({ type, label, color }) => (
          <li key={type} style={{ '--fb-color': color }}>
            <span className="totals__swatch" aria-hidden="true" />
            {label}: <strong>{totals[type] ?? 0}</strong>
            {sum > 0 && <span className="muted">({Math.round(((totals[type] ?? 0) / sum) * 100)}%)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
