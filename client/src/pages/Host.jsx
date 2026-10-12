import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import CountsGrid from '../components/CountsGrid.jsx';
import EndSessionButton from '../components/EndSessionButton.jsx';
import Gauge from '../components/Gauge.jsx';
import JoinPanel from '../components/JoinPanel.jsx';
import StateScreen from '../components/StateScreen.jsx';
import TimelineChart from '../components/TimelineChart.jsx';
import { useSessionInfo } from '../hooks/useSessionInfo.js';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { api } from '../lib/api.js';
import { sanitizeCode } from '../lib/constants.js';
import { getHostToken } from '../lib/storage.js';

const EMPTY_PULSE = { score: 0, level: 'Clear', counts: {}, activeStudents: 0, ts: null };

export default function Host() {
  const code = sanitizeCode(useParams().code);
  const navigate = useNavigate();
  const hostToken = useMemo(() => getHostToken(code), [code]);
  const { loading, session, error, notFound } = useSessionInfo(code);

  const [pulse, setPulse] = useState(EMPTY_PULSE);
  const [timeline, setTimeline] = useState([]);
  const [present, setPresent] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(null);

  const auth = session?.active && hostToken ? { role: 'host', code, hostToken } : null;
  const socket = useSessionSocket(auth, {
    'pulse:update': setPulse,
    'presence:update': ({ activeStudents }) => setPulse((prev) => ({ ...prev, activeStudents })),
    'timeline:init': setTimeline,
    'timeline:point': (point) => setTimeline((prev) => [...prev, point]),
  });

  const isOver = socket.ended || (session && !session.active);
  useEffect(() => {
    if (isOver && hostToken) navigate(`/summary/${code}`, { replace: true });
  }, [isOver, hostToken, code, navigate]);

  const togglePresent = useCallback(() => setPresent((value) => !value), []);

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

  const home = <Link className="btn" to="/">Back to home</Link>;

  if (loading) return <StateScreen loading title="Loading dashboard…" />;
  if (notFound) return <StateScreen icon="🔍" title="Session not found" message={`No session with the code ${code || '—'}.`}>{home}</StateScreen>;
  if (error) return <StateScreen icon="⚠️" title="Something went wrong" message={error}>{home}</StateScreen>;
  if (!hostToken || socket.error) {
    return (
      <StateScreen
        icon="🔒"
        title="Host access only"
        message={socket.error || 'This browser does not hold the host key for this session. Open it on the device that created it.'}
      >
        <Link className="btn btn--primary" to={`/join/${code}`}>Join as a student</Link>
      </StateScreen>
    );
  }

  return (
    <>
      <ConnectionBanner status={socket.status} />
      <div className="page-head">
        <div>
          <p className="muted">Live session</p>
          <h1>{session.title}</h1>
        </div>
        <span className="badge badge--live">● Live</span>
      </div>

      <div className="dash">
        <div className="stack">
          <section className="card dash__gauge" aria-label="Confusion meter">
            <Gauge score={pulse.score} level={pulse.level} />
            <div className="presence">
              <strong>{pulse.activeStudents}</strong> {pulse.activeStudents === 1 ? 'student' : 'students'} connected
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Last 2 minutes</h2>
            <CountsGrid counts={pulse.counts} />
          </section>

          <section className="card">
            <h2 className="card__title">Confusion over time</h2>
            <TimelineChart data={chartData} />
          </section>
        </div>

        <div className="stack">
          <JoinPanel code={code} present={present} onTogglePresent={togglePresent} />
          <section className="card">
            <EndSessionButton onConfirm={handleEnd} busy={ending} error={endError} />
          </section>
        </div>
      </div>
    </>
  );
}
