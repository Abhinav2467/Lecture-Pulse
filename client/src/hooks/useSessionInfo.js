import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Public session lookup used by pages before they open a socket.
export function useSessionInfo(code) {
  const [state, setState] = useState({ loading: true, session: null, error: null, notFound: false });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, session: null, error: null, notFound: false });
    api
      .getSession(code)
      .then((session) => !cancelled && setState({ loading: false, session, error: null, notFound: false }))
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, session: null, error: err.message, notFound: err.status === 404 });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return state;
}
