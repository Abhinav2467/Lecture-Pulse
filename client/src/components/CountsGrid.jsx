import { FEEDBACK } from '../lib/constants.js';

export default function CountsGrid({ counts = {} }) {
  return (
    <div className="counts">
      {FEEDBACK.map(({ type, label, emoji, color }) => (
        <div key={type} className="count" style={{ '--fb-color': color }}>
          <span className="count__value">{counts[type] ?? 0}</span>
          <span className="count__label">
            <span aria-hidden="true">{emoji} </span>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
