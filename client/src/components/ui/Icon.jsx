// Inline stroke icons, 24x24, drawn with currentColor.
const PATHS = {
  lost: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.4a2.8 2.8 0 1 1 4.5 2.3c-.9.6-1.8 1.2-1.8 2.4" />
      <path d="M12 17.3v.1" />
    </>
  ),
  fast: <path d="M5 6l6 6-6 6M13 6l6 6-6 6" />,
  example: <path d="M9.2 18h5.6M10.3 21h3.4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  gauge: <path d="M4 16a8 8 0 1 1 16 0M12 16l4.2-5.2" />,
  flag: <path d="M6 21V4h11l-2.2 4 2.2 4H6" />,
  bell: <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2.2 2.2 0 0 0 4 0" />,
  poll: <path d="M6 20V11M12 20V4M18 20v-6" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.4 14a4.1 4.1 0 0 0 7.2 0M9 9.6v.1M15 9.6v.1" />
    </>
  ),
  replay: <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4v3.8h3.8M10.4 9.3v5.4l4.3-2.7-4.3-2.7Z" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  tap: (
    <>
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="12" cy="12" r="8.5" strokeOpacity="0.5" />
    </>
  ),
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.2" />
      <path d="M11 17.8h2" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </>
  ),
  download: <path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 20h14" />,
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.1M11 10h.1M15 10h.1M8 14h8" />
    </>
  ),
  sound: <path d="M4 10v4h3l4 3.5v-11L7 10H4ZM15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />,
  mute: <path d="M4 10v4h3l4 3.5v-11L7 10H4ZM15.5 9.5l5 5M20.5 9.5l-5 5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  screen: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  warn: <path d="M12 4l9 16H3L12 4ZM12 10v4.5M12 17.4v.1" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  chart: <path d="M4 19h16M5 15l4-5 4 3 6-8" />,
};

export default function Icon({ name, size = 18, strokeWidth = 1.7, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
