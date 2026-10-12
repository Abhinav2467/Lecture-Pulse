import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function JoinPanel({ code, present, onTogglePresent }) {
  const url = `${window.location.origin}/join/${code}`;

  useEffect(() => {
    if (!present) return undefined;
    const onKey = (event) => event.key === 'Escape' && onTogglePresent();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [present, onTogglePresent]);

  return (
    <section
      className={`join-panel ${present ? 'join-panel--present' : 'card'}`}
      aria-label="Join this session"
    >
      <h2 className="card__title">Join at {window.location.host}</h2>
      <div className="join-panel__code" aria-label={`Session code ${code.split('').join(' ')}`}>
        {code}
      </div>
      <div className="join-panel__qr">
        <QRCodeSVG value={url} size={512} level="M" title={`QR code to join session ${code}`} />
      </div>
      <p className="join-panel__url">{url}</p>
      <button type="button" className="btn" aria-pressed={present} onClick={onTogglePresent}>
        {present ? 'Exit present mode (Esc)' : 'Present mode'}
      </button>
    </section>
  );
}
