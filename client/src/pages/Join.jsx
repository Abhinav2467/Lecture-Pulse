import { useEffect, useMemo, useState } from 'react';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import CooldownRing from '../components/CooldownRing.jsx';
import FeedbackTile from '../components/FeedbackTile.jsx';
import PollOverlay from '../components/PollOverlay.jsx';
import ReactionRow from '../components/ReactionRow.jsx';
import StateScreen from '../components/StateScreen.jsx';
import Appear from '../components/ui/Appear.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import { useCooldown } from '../hooks/useCooldown.js';
import { useSessionInfo } from '../hooks/useSessionInfo.js';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { FEEDBACK, sanitizeCode } from '../lib/constants.js';
import { getClientId } from '../lib/storage.js';
import { useParams } from 'react-router-dom';
import '../styles/join.css';

const RESULT_MS = 4000; // how long the poll result stays on screen

export default function Join() {
  const code = sanitizeCode(useParams().code);
  const { loading, session, error, notFound } = useSessionInfo(code);
  const clientId = useMemo(getClientId, []);
  const [topic, setTopic] = useState(null);
  const [poll, setPoll] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const [showSent, setShowSent] = useState(false);
  const cooldown = useCooldown();

  const auth = session?.active ? { role: 'student', code, clientId } : null;
  const socket = useSessionSocket(auth, {
    'topic:update': setTopic,
    'poll:started': (p) => setPoll({ ...p, endsAt: Date.now() + p.remainingMs, voted: null, result: null }),
    'poll:result': (result) => setPoll((prev) => (prev && prev.id === result.id ? { ...prev, result } : prev)),
  });

  useEffect(() => {
    if (!showSent) return undefined;
    const id = setTimeout(() => setShowSent(false), 2500);
    return () => clearTimeout(id);
  }, [showSent, lastSent]);

  // Show the result briefly, then get out of the way.
  useEffect(() => {
    if (!poll?.result) return undefined;
    const id = setTimeout(() => setPoll(null), RESULT_MS);
    return () => clearTimeout(id);
  }, [poll?.result]);

  // If the result never arrives (connection dropped), don't trap the student.
  useEffect(() => {
    if (!poll || poll.result) return undefined;
    const id = setTimeout(() => setPoll(null), Math.max(0, poll.endsAt - Date.now()) + 3000);
    return () => clearTimeout(id);
  }, [poll]);

  function send(type) {
    if (cooldown.active || socket.status !== 'connected') return;
    socket.emit('feedback:send', { type }, (res) => {
      if (res?.ok) {
        cooldown.start(res.cooldownMs);
        setLastSent(type);
        setShowSent(true);
        navigator.vibrate?.(15);
      } else if (res?.retryInMs > 0) {
        // Server says we are still cooling down (e.g. tapped in another tab): sync the ring.
        cooldown.start(res.retryInMs);
      }
    });
  }

  function vote(choice) {
    if (!poll || poll.voted) return;
    setPoll((prev) => prev && { ...prev, voted: choice });
    socket.emit('poll:vote', { pollId: poll.id, choice });
  }

  const home = <Button variant="ghost" to="/">Back to home</Button>;
  let body;

  if (loading) {
    body = <StateScreen loading title="Finding session…" />;
  } else if (notFound) {
    body = (
      <StateScreen icon="search" title={<>Session <em>not found</em></>} message={`No session with the code ${code || '—'}. Check the code and try again.`}>
        {home}
      </StateScreen>
    );
  } else if (error || socket.error) {
    body = <StateScreen title="Something went wrong" message={error || socket.error}>{home}</StateScreen>;
  } else if (!session.active || socket.ended) {
    body = (
      <StateScreen icon="check" title={<>This session has <em>ended</em></>} message={`Thanks for your feedback on “${session.title}”.`}>
        {home}
      </StateScreen>
    );
  }

  if (body) return <main className="main">{body}</main>;

  const connected = socket.status === 'connected';

  return (
    <main>
      <ConnectionBanner status={socket.status} />
      <section className="student">
        <Appear className="student-head" variant="soft" delay={0.1}>
          <span className="chip">
            <span className="chip-dot" aria-hidden="true" />
            Live · <span className="mono">{code}</span>
          </span>
          <h1>{session.title}</h1>
          <p className="student-topic" aria-live="polite">
            {topic ? <>Now: <em>{topic.label}</em></> : ' '}
          </p>
        </Appear>

        <Appear variant="scale" delay={0.2}>
          <CooldownRing active={cooldown.active} progress={cooldown.progress} remainingMs={cooldown.remainingMs} />
        </Appear>
        <p className={`sent ${showSent ? 'is-visible' : ''}`} role="status" aria-live="polite">
          {showSent && (
            <>
              <Icon name="check" size={15} /> Sent
            </>
          )}
        </p>

        <div className="tiles">
          {FEEDBACK.map((option, i) => (
            <Appear key={option.type} variant="btn" delay={0.28 + i * 0.08}>
              <FeedbackTile
                option={option}
                disabled={!connected || cooldown.active}
                highlighted={cooldown.active && lastSent === option.type}
                onSend={send}
              />
            </Appear>
          ))}
        </div>

        <Appear variant="soft" delay={0.66}>
          <ReactionRow disabled={!connected} emit={socket.emit} />
        </Appear>
        <Appear as="p" variant="soft" delay={0.74} className="hint">
          Anonymous. One tap every 8 seconds.
        </Appear>
      </section>

      {poll && <PollOverlay poll={poll} onVote={vote} />}
    </main>
  );
}
