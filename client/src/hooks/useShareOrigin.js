import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

// Origin to put in links and QR codes meant for other devices. A dashboard
// opened on localhost would hand phones a link to themselves, so in development
// swap in this machine's LAN address (reported by the server).
export function useShareOrigin() {
  const [origin, setOrigin] = useState(window.location.origin);

  useEffect(() => {
    const { hostname, protocol, port } = window.location;
    if (!LOOPBACK.has(hostname)) return undefined;
    let cancelled = false;
    api
      .getHealth()
      .then(({ lan }) => {
        if (!cancelled && lan) setOrigin(`${protocol}//${lan}${port ? `:${port}` : ''}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return origin;
}
