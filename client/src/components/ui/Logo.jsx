// Capsule with a single ECG pulse. The same drawing is the favicon (index.html).
export function LogoMark(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="1.5" y="6" width="21" height="12" rx="6" fill="currentColor" />
      <polyline
        points="5,12 8.6,12 10.3,8.8 12.7,15.4 14.4,10.6 15.4,12 19,12"
        fill="none"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo() {
  return (
    <>
      <LogoMark />
      <span>
        Lecture<span className="logo-suffix">Pulse</span>
      </span>
    </>
  );
}
