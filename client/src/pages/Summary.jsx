import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatCard from '../components/StatCard.jsx';
import StateScreen from '../components/StateScreen.jsx';
import TimelineChart from '../components/TimelineChart.jsx';
import TotalsBar from '../components/TotalsBar.jsx';
import { api } from '../lib/api.js';
import { levelColor, levelForScore, sanitizeCode } from '../lib/constants.js';
import { formatClock, formatDateTime, formatDuration } from '../lib/format.js';
import { getHostToken } from '../lib/storage.js';

export default function Summary() {
  const code = sanitizeCode(useParams().code);
  const hostToken = useMemo(() => getHostToken(code), [code]);
  const [state, setState] = useState({ loading: true, summary: null, error: null, status: null });

  useEffect(() => {
    if (!hostToken) return undefined;
    let cancelled = false;
    setState({ loading: true, summary: null, error: null, status: null });
    api
      .getSummary(code, hostToken)
      .then((summary) => !cancelled && setState({ loading: false, summary, error: null, status: 200 }))
      .catch((err) => !cancelled && setState({ loading: false, summary: null, error: err.message, status: err.status }));
    return () => {
      cancelled = true;
    };
  }, [code, hostToken]);

  const home = <Link className="btn" to="/">Back to home</Link>;

  if (!hostToken || state.status === 401) {
    return (
      <StateScreen icon="🔒" title="Host access only" message="Summaries are only available on the device that hosted the session.">
        {home}
      </StateScreen>
    );
  }
  if (state.loading) return <StateScreen loading title="Building summary…" />;
  if (state.status === 404) return <StateScreen icon="🔍" title="Session not found" message={`No session with the code ${code}.`}>{home}</StateScreen>;
  if (state.error) return <StateScreen icon="⚠️" title="Something went wrong" message={state.error}>{home}</StateScreen>;

  const s = state.summary;
  const peakColor = levelColor(levelForScore(s.peakScore));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="muted">Session summary · <span className="mono">{s.code}</span> · {formatDateTime(s.createdAt)}</p>
          <h1>{s.title}</h1>
        </div>
        {s.active ? (
          <Link className="btn btn--primary" to={`/host/${s.code}`}>Back to live dashboard</Link>
        ) : (
          <span className="badge badge--ended">Ended</span>
        )}
      </div>

      <div className="stats">
        <StatCard label="Duration" value={formatDuration(s.durationMs)} hint={s.active ? 'so far' : null} />
        <StatCard label="Participants" value={s.uniqueParticipants} hint="sent at least one tap" />
        <StatCard
          label="Peak confusion"
          value={s.peakScore}
          color={peakColor}
          hint={s.peakAt ? `at ${formatClock(s.peakAt)}` : 'no data'}
        />
        <StatCard label="Average confusion" value={s.avgScore} color={levelColor(levelForScore(s.avgScore))} />
      </div>

      <section className="card">
        <h2 className="card__title">All feedback</h2>
        <TotalsBar totals={s.totals} />
      </section>

      <section className="card">
        <h2 className="card__title">Confusion over time</h2>
        <TimelineChart data={s.timeline} markers={s.topConfusionMoments} height={280} />
      </section>

      <section className="card">
        <h2 className="card__title">Top confusion moments</h2>
        {s.topConfusionMoments.length === 0 ? (
          <p className="muted">No confusion recorded. Either a very clear lecture or a very quiet room.</p>
        ) : (
          <ol className="moments">
            {s.topConfusionMoments.map((moment) => (
              <li key={moment.ts}>
                <span>
                  <strong>{formatClock(moment.ts)}</strong>{' '}
                  <span className="muted">· {formatDuration(moment.ts - s.createdAt)} in</span>
                </span>
                <span className="moments__score" style={{ color: levelColor(levelForScore(moment.score)) }}>
                  {moment.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="row">
        <Link className="btn" to="/history">All sessions</Link>
        <Link className="btn btn--ghost" to="/">Start another</Link>
      </div>
    </div>
  );
}
