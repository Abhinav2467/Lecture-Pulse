const POINTS = '0,12 26,12 32,12 37,3 43,21 48,7 52,12 58,12 62,9 66,12 100,12';

// Decorative ECG trace: a bright segment sweeps along a dim baseline.
export default function PulseLine() {
  return (
    <svg className="pulse-line" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline className="pulse-line__base" points={POINTS} />
      <polyline className="pulse-line__trace" points={POINTS} pathLength="100" />
    </svg>
  );
}
