import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import CooldownRing from '../components/CooldownRing.jsx';
import FeedbackButton from '../components/FeedbackButton.jsx';
import StateScreen from '../components/StateScreen.jsx';
import { useCooldown } from '../hooks/useCooldown.js';
import { useSessionInfo } from '../hooks/useSessionInfo.js';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { FEEDBACK, sanitizeCode } from '../lib/constants.js';
import { getClientId } from '../lib/storage.js';

export default function Join() {
  const code = sanitizeCode(useParams().code);
  const { loading, session, error, notFound } = useSessionInfo(code);
  const clientId = useMemo(getClientId, []);
  const auth = session?.active ? { role: 'student', code, clientId } : null;
  const socket = useSessionSocket(auth);
  const cooldown = useCooldown();
  const [lastSent, setLastSent] = useState(null);
  const [showSent, setShowSent] = useState(false);

  useEffect(() => {
    if (!showSent) return undefined;
    const id = setTimeout(() => setShowSent(false), 2500);
    return () => clearTimeout(id);
  }, [showSent, lastSent]);

  function send(type) {
    if (cooldown.active || socket.status !== 'connected') return;
    socket.emit('feedback:send', { type }, (res) => {
      if (res?.ok) {
        cooldown.start(res.cooldownMs);
        setLastSent(type);
        setShowSent(true);
      } else if (res?.retryInMs > 0) {
        // Server says we are still cooling down (e.g. tapped in another tab): sync the ring.
        cooldown.start(res.retryInMs);
      }
    });
  }

  const home = <Link className="btn" to="/">Back to home</Link>;

  if (loading) return <StateScreen loading title="Finding session…" />;
  if (notFound) {
    return (
      <StateScreen icon="🔍" title="Session not found" message={`No session with the code ${code || '—'}. Check the code and try again.`}>
        {home}
      </StateScreen>
    );
  }
  if (error || socket.error) {
    return <StateScreen icon="⚠️" title="Something went wrong" message={error || socket.error}>{home}</StateScreen>;
  }
  if (!session.active || socket.ended) {
    return (
      <StateScreen icon="👋" title="This session has ended" message={`Thanks for your feedback on “${session.title}”.`}>
        {home}
      </StateScreen>
    );
  }

  const ready = socket.status === 'connected' && !cooldown.active;

  return (
    <>
      <ConnectionBanner status={socket.status} />
      <section className="student">
        <div>
          <p className="muted mono">{code}</p>
          <h1>{session.title}</h1>
        </div>

        <CooldownRing active={cooldown.active} progress={cooldown.progress} remainingMs={cooldown.remainingMs} />
        <p className={`sent ${showSent ? 'sent--visible' : ''}`} role="status" aria-live="polite">
          {showSent ? 'Sent ✓' : ''}
        </p>

        <div className="fb-grid">
          {FEEDBACK.map((option) => (
            <FeedbackButton
              key={option.type}
              option={option}
              disabled={!ready}
              highlighted={cooldown.active && lastSent === option.type}
              onSend={send}
            />
          ))}
        </div>
        <p className="muted">Anonymous. One tap every 8 seconds.</p>
      </section>
    </>
  );
}
