const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// progress: 1 (just tapped) → 0 (ready again)
export default function CooldownRing({ active, progress, remainingMs }) {
  const seconds = Math.ceil(remainingMs / 1000);
  return (
    <div
      className={`cooldown ${active ? '' : 'cooldown--ready'}`}
      role="timer"
      aria-label={active ? `Next tap in ${seconds} seconds` : 'Ready to send feedback'}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="cooldown-track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="cooldown-progress"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - (active ? progress : 1))}
        />
      </svg>
      <span className="cooldown-label" aria-hidden="true">{active ? `${seconds}s` : 'Ready'}</span>
    </div>
  );
}
