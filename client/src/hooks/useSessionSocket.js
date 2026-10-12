import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Connects to the session room once `auth` is non-null.
 * status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'
 * `handlers` maps extra event names to callbacks (kept in a ref, so they may
 * change every render without reconnecting).
 */
export function useSessionSocket(auth, handlers = {}) {
  const [status, setStatus] = useState('idle');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [ended, setEnded] = useState(false);
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const authKey = auth ? JSON.stringify(auth) : null;

  useEffect(() => {
    if (!authKey) return undefined;

    // No URL: same origin in production, proxied by Vite in development.
    const socket = io({ auth: JSON.parse(authKey) });
    socketRef.current = socket;
    setStatus('connecting');
    setError(null);

    socket.on('connect', () => setStatus('connected'));
    socket.on('connect_error', () => setStatus('reconnecting'));
    socket.on('disconnect', (reason) => {
      // Deliberate closes (by either side) are final; anything else auto-retries.
      const final = reason === 'io server disconnect' || reason === 'io client disconnect';
      setStatus(final ? 'closed' : 'reconnecting');
    });
    socket.on('session:info', (payload) => {
      setInfo(payload);
      if (!payload.active) setEnded(true);
    });
    socket.on('session:error', (payload) => setError(payload?.message || 'Unable to join this session'));
    socket.on('session:ended', () => {
      setEnded(true);
      socket.disconnect();
    });
    socket.onAny((event, ...args) => handlersRef.current[event]?.(...args));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authKey]);

  const emit = useCallback((event, payload, ack) => {
    socketRef.current?.emit(event, payload, ack);
  }, []);

  return { status, info, error, ended, emit };
}
