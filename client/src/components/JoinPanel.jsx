import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useShareOrigin } from '../hooks/useShareOrigin.js';
import { hostLink } from '../lib/storage.js';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';

export const joinUrl = (code, origin = window.location.origin) => `${origin}/join/${code}`;

export function JoinQr({ code }) {
  const origin = useShareOrigin();
  return (
    <div className="qr">
      <QRCodeSVG value={joinUrl(code, origin)} size={512} level="M" title={`QR code to join session ${code}`} />
    </div>
  );
}

export default function JoinPanel({ code, hostToken, onPresent }) {
  const [copied, setCopied] = useState(false);
  const origin = useShareOrigin();

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(id);
  }, [copied]);

  async function copyHostLink() {
    const link = hostLink(code, hostToken, origin);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API needs a secure context; fall back to a manual copy.
      window.prompt('Copy this host link', link);
    }
    setCopied(true);
  }

  return (
    <section className="card join-panel" aria-label="Join this session">
      <h2 className="card-title" style={{ alignSelf: 'stretch' }}>
        <span>Join</span>
        <span>{new URL(origin).host}</span>
      </h2>
      <div className="join-code" aria-label={`Session code ${code.split('').join(' ')}`}>{code}</div>
      <JoinQr code={code} />
      <p className="join-url">{joinUrl(code, origin)}</p>
      <Button onClick={onPresent}>
        <Icon name="screen" size={16} /> Present mode <kbd>F</kbd>
      </Button>
      <Button variant="ghost" onClick={copyHostLink}>
        <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Host link copied' : 'Copy host link'}
      </Button>
      <p className="hint">The host link grants full control of this session. Share it only with co-hosts.</p>
    </section>
  );
}
