import { levelColor } from '../lib/constants.js';

const ARC = 'M 14 104 A 86 86 0 0 1 186 104';

export default function Gauge({ score = 0, level = 'Clear' }) {
  // The readout "beats" faster as confusion rises: 1.6s at 0 down to 0.45s at 100.
  const beat = (1.6 - (score / 100) * 1.15).toFixed(2);

  return (
    <div
      className="gauge"
      style={{ '--gauge-color': levelColor(level), '--beat': `${beat}s` }}
      role="meter"
      aria-label="Confusion score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-valuetext={`${score} out of 100, ${level}`}
    >
      <svg className="gauge__svg" viewBox="0 0 200 116" aria-hidden="true">
        <path className="gauge__track" d={ARC} />
        {/* pathLength=100 lets the score be used directly as the dash length */}
        <path className="gauge__value" d={ARC} pathLength="100" strokeDasharray={`${score} 100`} />
      </svg>
      <div className="gauge__readout">
        <span className="gauge__score">{score}</span>
        <span className="gauge__level">{level}</span>
      </div>
    </div>
  );
}
