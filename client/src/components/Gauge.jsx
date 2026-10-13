import { levelColor } from '../lib/constants.js';
import '../styles/gauge.css';

const ARC = 'M 12 104 A 88 88 0 0 1 188 104';
const THRESHOLDS = [30, 60];

// Point on the arc for a score (0 = left end, 100 = right end).
function tick(score, inner, outer) {
  const angle = Math.PI * (1 - score / 100);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x1: 100 + cos * inner, y1: 104 - sin * inner, x2: 100 + cos * outer, y2: 104 - sin * outer };
}

export default function Gauge({ score = 0, level = 'Clear', size }) {
  // Breathing gets faster as confusion rises: 3.2s at 0 down to 0.8s at 100.
  const beat = (3.2 - (score / 100) * 2.4).toFixed(2);
  const shown = Math.round(score);

  return (
    <div
      className={`gauge ${size ? `gauge--${size}` : ''}`}
      style={{ '--gauge-color': levelColor(level), '--beat': `${beat}s` }}
      role="meter"
      aria-label="Confusion score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      aria-valuetext={`${shown} out of 100, ${level}`}
    >
      <svg viewBox="0 0 200 112" aria-hidden="true">
        <path className="gauge-track" d={ARC} />
        <g className="gauge-ticks">
          {THRESHOLDS.map((value) => (
            <line key={value} {...tick(value, 95, 100)} />
          ))}
        </g>
        {/* pathLength=100 lets the score be used directly as the dash length */}
        {score > 0 && (
          <g className="gauge-glow">
            <path className="gauge-value" d={ARC} pathLength="100" strokeDasharray={`${score} 100`} />
          </g>
        )}
      </svg>
      <div className="gauge-readout">
        <span className="gauge-score">{shown}</span>
        <span className="gauge-level">{level}</span>
      </div>
    </div>
  );
}
