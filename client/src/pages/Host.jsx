import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AlertBanner from '../components/AlertBanner.jsx';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import CountsGrid from '../components/CountsGrid.jsx';
import EndSessionButton from '../components/EndSessionButton.jsx';
import Gauge from '../components/Gauge.jsx';
import JoinPanel from '../components/JoinPanel.jsx';
import PollPanel from '../components/PollPanel.jsx';
import PresentMode from '../components/PresentMode.jsx';
import ReactionLayer from '../components/ReactionLayer.jsx';
import ShortcutsModal from '../components/ShortcutsModal.jsx';
import StateScreen from '../components/StateScreen.jsx';
import TimelineChart from '../components/TimelineChart.jsx';
import TopicControl from '../components/TopicControl.jsx';
import Appear from '../components/ui/Appear.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import { useSessionInfo } from '../hooks/useSessionInfo.js';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { api } from '../lib/api.js';
import { sanitizeCode } from '../lib/constants.js';
import { playChime } from '../lib/sound.js';
import { getAlertSound, getHostToken, importHostToken, setAlertSound, setHostSessionTitle } from '../lib/storage.js';
import '../styles/host.css';

const EMPTY_PULSE = { score: 0, level: 'Clear', counts: {}, activeStudents: 0, ts: null };
const EMPTY_POLL_COUNTS = { YES: 0, UNSURE: 0, NO: 0 };
const MAX_REACTIONS = 30;
const REACTION_LIFETIME_MS = 3600; // matches the float-up animation in host.css

const isTyping = (target) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export default function Host() {
  const code = sanitizeCode(useParams().code);
  const navigate = useNavigate();
  // A host link (#t=token) is imported once, then the hash is stripped.
  const hostToken = useMemo(() => importHostToken(code) ?? getHostToken(code), [code]);
  const { loading, session, error, notFound } = useSessionInfo(code);

  const [pulse, setPulse] = useState(EMPTY_PULSE);
  const [timeline, setTimeline] = useState([]);
  const [topics, setTopics] = useState([]);
  const [alert, setAlert] = useState(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [sound, setSound] = useState(getAlertSound);
  const [poll, setPoll] = useState(null);
  const [pollError, setPollError] = useState('');
  const [reactions, setReactions] = useState([]);
  const [present, setPresent] = useState(false);
  const [help, setHelp] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(null);

  const topicInputRef = useRef(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const reactionId = useRef(0);

  const addReaction = useCallback(({ emoji }) => {
    const id = ++reactionId.current;
    const item = {
      id,
      emoji,
      x: 4 + Math.random() * 90,
      sway: Math.round(Math.random() * 120 - 60),
      tilt: Math.round(Math.random() * 30 - 15),
      size: 26 + Math.round(Math.random() * 14),
    };
    // Never more than MAX_REACTIONS on screen: the oldest make room.
    setReactions((prev) => [...prev.slice(-(MAX_REACTIONS - 1)), item]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), REACTION_LIFETIME_MS);
  }, []);

  const auth = session?.active && hostToken ? { role: 'host', code, hostToken } : null;
  const socket = useSessionSocket(auth, {
    'pulse:update': setPulse,
    'presence:update': ({ activeStudents }) => setPulse((prev) => ({ ...prev, activeStudents })),
    'timeline:init': setTimeline,
    'timeline:point': (point) => setTimeline((prev) => [...prev, point]),
    'topics:init': setTopics,
    'topic:update': (topic) => setTopics((prev) => (prev.some((t) => t.id === topic.id) ? prev : [...prev, topic])),
    'alert:lost': (payload) => {
      setAlert(payload);
      setAlertDismissed(false);
      if (soundRef.current) playChime();
    },
    'alert:clear': () => setAlert(null),
    'poll:started': (p) =>
      setPoll({ id: p.id, question: p.question, endsAt: Date.now() + p.remainingMs, counts: EMPTY_POLL_COUNTS, total: 0, live: true }),
    'poll:update': (tally) => setPoll((prev) => (prev?.id === tally.id ? { ...prev, ...tally } : prev)),
    'poll:result': (tally) => setPoll((prev) => ({ ...prev, ...tally, live: false })),
    'reaction:new': addReaction,
  });

  const isOver = socket.ended || (session && !session.active);
  useEffect(() => {
    if (isOver && hostToken) navigate(`/summary/${code}`, { replace: true });
  }, [isOver, hostToken, code, navigate]);

  // Imported host links arrive without a title; fill it in for the history page.
  useEffect(() => {
    if (session?.title && hostToken) setHostSessionTitle(code, session.title);
  }, [session?.title, hostToken, code]);

  const togglePresent = useCallback(() => setPresent((value) => !value), []);
  const { emit } = socket;

  const startPoll = useCallback(
    (question = '') => {
      setPollError('');
      emit('poll:start', question.trim() ? { question } : {}, (res) => {
        if (!res?.ok) setPollError(res?.error || 'Could not start the poll');
      });
    },
    [emit],
  );

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setAlertSound(next);
    if (next) playChime(); // doubles as the user gesture browsers need to allow audio
  }

  // Keyboard shortcuts: T topic, P poll, F present, ? help. Never while typing.
  useEffect(() => {
    function onKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 't') {
        event.preventDefault();
        setPresent(false);
        topicInputRef.current?.focus();
      } else if (key === 'p') {
        event.preventDefault();
        startPoll();
      } else if (key === 'f') {
        event.preventDefault();
        togglePresent();
      } else if (event.key === '?') {
        event.preventDefault();
        setHelp((value) => !value);
      } else if (event.key === 'Escape') {
        setPresent(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startPoll, togglePresent]);

  // Persisted 15s samples plus a trailing "now" point so the line moves between samples.
  const chartData = useMemo(
    () => (pulse.ts ? [...timeline, { ts: pulse.ts, score: pulse.score }] : timeline),
    [timeline, pulse.ts, pulse.score],
  );

  async function handleEnd() {
    setEnding(true);
    setEndError(null);
    try {
      await api.endSession(code, hostToken);
      navigate(`/summary/${code}`, { replace: true });
    } catch (err) {
      setEndError(err.message);
      setEnding(false);
    }
  }

  const home = <Button variant="ghost" to="/">Back to home</Button>;
  let body;
  if (loading) body = <StateScreen loading title="Loading dashboard…" />;
  else if (notFound) body = <StateScreen icon="search" title={<>Session <em>not found</em></>} message={`No session with the code ${code || '—'}.`}>{home}</StateScreen>;
  else if (error) body = <StateScreen title="Something went wrong" message={error}>{home}</StateScreen>;
  else if (!hostToken || socket.error) {
    body = (
      <StateScreen
        icon="lock"
        title={<>Host access <em>only</em></>}
        message={socket.error || 'This browser does not hold the host key for this session. Open the host link, or the device that created it.'}
      >
        <Button to={`/join/${code}`}>Join as a student</Button>
        {home}
      </StateScreen>
    );
  }
  if (body) return <main className="main">{body}</main>;

  const currentTopic = topics.at(-1) ?? null;
  const connected = socket.status === 'connected';

  return (
    <main className="main dash-main">
      <ConnectionBanner status={socket.status} />

      <Appear className="page-head" variant="soft" delay={0.1}>
        <div>
          <div className="eyebrow">
            <span className="chip">
              <span className="chip-dot" aria-hidden="true" /> Live
            </span>
            <span className="mono">{code}</span>
          </div>
          <h1>{session.title}</h1>
        </div>
        <div className="row">
          <button
            type="button"
            className="icon-btn"
            aria-pressed={sound}
            aria-label={`Alert sound ${sound ? 'on' : 'off'}`}
            title={`Alert sound ${sound ? 'on' : 'off'}`}
            onClick={toggleSound}
          >
            <Icon name={sound ? 'sound' : 'mute'} size={17} />
          </button>
          <button type="button" className="icon-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={() => setHelp(true)}>
            <Icon name="keyboard" size={17} />
          </button>
        </div>
      </Appear>

      {alert && !alertDismissed && <AlertBanner alert={alert} onDismiss={() => setAlertDismissed(true)} />}

      <div className="dash">
        <Appear className="stack" variant="soft" delay={0.18}>
          <section className="card gauge-card" aria-label="Confusion meter">
            <Gauge score={pulse.score} level={pulse.level} />
            <p className="presence">
              <strong>{pulse.activeStudents}</strong> {pulse.activeStudents === 1 ? 'student' : 'students'} connected
            </p>
          </section>
          <section className="card">
            <h2 className="card-title">
              <span>Last 2 minutes</span>
              <span>latest tap per student</span>
            </h2>
            <CountsGrid counts={pulse.counts} />
          </section>
        </Appear>

        <Appear className="stack dash-col--wide" variant="soft" delay={0.28}>
          <section className="card">
            <h2 className="card-title">
              <span>Confusion over time</span>
            </h2>
            <TimelineChart data={chartData} topics={topics} height={250} />
          </section>
          <div className="dash-pair">
            <TopicControl current={currentTopic} emit={emit} inputRef={topicInputRef} disabled={!connected} />
            <PollPanel poll={poll} onStart={startPoll} error={pollError} disabled={!connected} />
          </div>
        </Appear>

        <Appear className="stack" variant="soft" delay={0.38}>
          <JoinPanel code={code} hostToken={hostToken} onPresent={togglePresent} />
          <EndSessionButton onConfirm={handleEnd} busy={ending} error={endError} />
        </Appear>
      </div>

      {present && <PresentMode code={code} pulse={pulse} topic={currentTopic} onExit={togglePresent} />}
      {help && <ShortcutsModal onClose={() => setHelp(false)} />}
      <ReactionLayer items={reactions} />
    </main>
  );
}
