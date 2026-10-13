import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PollBars from '../components/PollBars.jsx';
import StateScreen from '../components/StateScreen.jsx';
import TimelineChart from '../components/TimelineChart.jsx';
import Appear from '../components/ui/Appear.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import { api } from '../lib/api.js';
import { FEEDBACK, FEEDBACK_LABEL, REACTIONS, levelColor, levelForScore, sanitizeCode } from '../lib/constants.js';
import { formatClock, formatDateTime, formatDuration } from '../lib/format.js';
import { getHostToken } from '../lib/storage.js';
import '../styles/summary.css';

const ReplayPlayer = lazy(() => import('../components/ReplayPlayer.jsx'));

const LevelDot = ({ score }) => (
  <span className="level-dot" style={{ '--dot': levelColor(levelForScore(score)) }} aria-hidden="true" />
);

function Stat({ label, value, hint, score }) {
  return (
    <div className="card stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">
        {value}
        {score !== undefined && <LevelDot score={score} />}
      </div>
      {hint && <div className="stat-card-hint">{hint}</div>}
    </div>
  );
}

export default function Summary() {
  const code = sanitizeCode(useParams().code);
  const hostToken = useMemo(() => getHostToken(code), [code]);
  const [state, setState] = useState({ loading: true, summary: null, error: null, status: null });
  const [cursor, setCursor] = useState(undefined);

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

  const home = <Button variant="ghost" to="/">Back to home</Button>;
  let body;
  if (!hostToken || state.status === 401) {
    body = (
      <StateScreen icon="lock" title={<>Host access <em>only</em></>} message="Summaries open on a device that holds the host key. Use the host link to bring it to this one.">
        {home}
      </StateScreen>
    );
  } else if (state.loading) body = <StateScreen loading title="Building summary…" />;
  else if (state.status === 404) body = <StateScreen icon="search" title={<>Session <em>not found</em></>} message={`No session with the code ${code}.`}>{home}</StateScreen>;
  else if (state.error) body = <StateScreen title="Something went wrong" message={state.error}>{home}</StateScreen>;
  if (body) return <main className="main">{body}</main>;

  const s = state.summary;
  const totalTaps = FEEDBACK.reduce((sum, { type }) => sum + (s.totals[type] ?? 0), 0);
  const totalReactions = REACTIONS.reduce((sum, emoji) => sum + (s.reactions[emoji] ?? 0), 0);
  const peakMarker = s.peakAt ? [{ ts: s.peakAt, score: s.peakScore }] : [];
  const canReplay = s.timeline.length >= 2;

  return (
    <main className="main">
      <div className="stack">
        <Appear className="page-head" variant="soft" delay={0.1} style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">
              <span className={`chip ${s.active ? '' : 'chip--ended'}`}>
                <span className="chip-dot" aria-hidden="true" /> {s.active ? 'Live' : 'Ended'}
              </span>
              <span className="mono">{s.code}</span>
              <span>· {formatDateTime(s.createdAt)}</span>
            </div>
            <h1>
              {s.title} <em>summary</em>
            </h1>
          </div>
          <div className="row no-print">
            {s.active && <Button variant="ghost" to={`/host/${s.code}`}>Back to live dashboard</Button>}
            <Button variant="ghost" to="/history">All sessions</Button>
            <Button onClick={() => window.print()}>
              <Icon name="download" size={16} /> Download PDF
            </Button>
          </div>
        </Appear>

        {s.topicInsight && (
          <Appear className="card insight" variant="pop" delay={0.18}>
            <span className="insight-icon">
              <Icon name="flag" size={22} />
            </span>
            <div>
              <p>Headline insight</p>
              <em>{s.topicInsight}</em>
            </div>
          </Appear>
        )}

        <Appear className="stats-grid" variant="soft" delay={0.26}>
          <Stat label="Duration" value={formatDuration(s.durationMs)} hint={s.active ? 'so far' : formatClock(s.createdAt)} />
          <Stat label="Participants" value={s.uniqueParticipants} hint={`${totalTaps} taps`} />
          <Stat label="Peak confusion" value={s.peakScore} score={s.peakScore} hint={s.peakAt ? `at ${formatClock(s.peakAt)}` : 'no data'} />
          <Stat label="Average confusion" value={s.avgScore} score={s.avgScore} hint={levelForScore(s.avgScore)} />
          <Stat label="Alerts" value={s.alertCount} hint="losing the room" />
          <Stat label="Polls" value={s.polls.length} hint={`${totalReactions} reactions`} />
        </Appear>

        <Appear className="card" variant="soft" delay={0.34}>
          <h2 className="card-title">
            <span>Confusion over time</span>
            <span>peak and topics marked</span>
          </h2>
          <TimelineChart data={s.timeline} topics={s.topics} markers={peakMarker} cursor={cursor} height={280} />
        </Appear>

        {canReplay && (
          <Appear className="card no-print" variant="soft" delay={0.4}>
            <h2 className="card-title">
              <span>Replay</span>
              <span>scrub or play the session back</span>
            </h2>
            <Suspense fallback={<div className="skeleton" style={{ height: 150 }} />}>
              <ReplayPlayer timeline={s.timeline} topics={s.topics} onSeek={setCursor} />
            </Suspense>
          </Appear>
        )}

        <Appear className="summary-cols" variant="soft" delay={0.46}>
          <div className="stack">
            <section className="card">
              <h2 className="card-title">
                <span>Topic ranking</span>
                <span>most confusing first</span>
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Topic</th>
                      <th scope="col">Duration</th>
                      <th scope="col">Avg</th>
                      <th scope="col">Peak</th>
                      <th scope="col">Taps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.topicRanking.map((topic, i) => (
                      <tr key={topic.id}>
                        <td>
                          <span className="rank">{i + 1}</span>
                          <span className="topic-name">{topic.label}</span>
                        </td>
                        <td>{formatDuration(topic.durationMs)}</td>
                        <td>
                          {topic.avgScore ?? '—'}
                          {topic.avgScore !== null && <LevelDot score={topic.avgScore} />}
                        </td>
                        <td>{topic.peakScore ?? '—'}</td>
                        <td>{topic.taps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title">
                <span>Quick-check polls</span>
                <span>{s.polls.length}</span>
              </h2>
              {s.polls.length === 0 ? (
                <p className="empty">No polls were run in this session.</p>
              ) : (
                <div className="poll-list">
                  {s.polls.map((poll) => (
                    <div className="poll-item" key={poll.id}>
                      <h3>
                        <em>{poll.question}</em>
                        <span>
                          {formatClock(poll.startedAt)} · {poll.total} {poll.total === 1 ? 'vote' : 'votes'}
                        </span>
                      </h3>
                      <PollBars counts={poll.counts} total={poll.total} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="stack">
            <section className="card">
              <h2 className="card-title">
                <span>All feedback</span>
                <span>{totalTaps} taps</span>
              </h2>
              <div className="totals">
                {FEEDBACK.map(({ type, label }) => (
                  <div className="total-row" key={type}>
                    <span>{label}</span>
                    <div className="total-track">
                      <div className="total-fill" style={{ width: `${totalTaps ? ((s.totals[type] ?? 0) / totalTaps) * 100 : 0}%` }} />
                    </div>
                    <span>{s.totals[type] ?? 0}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h2 className="card-title">
                <span>Losing-the-room alerts</span>
                <span>{s.alertCount}</span>
              </h2>
              {s.alerts.length === 0 ? (
                <p className="empty">The room never stayed lost for 20 seconds.</p>
              ) : (
                <ul className="list">
                  {s.alerts.map((alert) => (
                    <li key={alert.startedAt}>
                      <span>
                        <strong>{formatClock(alert.startedAt)}</strong>
                        <small>mostly “{FEEDBACK_LABEL[alert.dominantType]}”</small>
                      </span>
                      <span className="muted">
                        {alert.endedAt ? `lasted ${formatDuration(alert.endedAt - alert.startedAt)}` : 'still active'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2 className="card-title">
                <span>Top confusion moments</span>
              </h2>
              {s.topConfusionMoments.length === 0 ? (
                <p className="empty">No confusion recorded.</p>
              ) : (
                <ul className="list">
                  {s.topConfusionMoments.map((moment) => (
                    <li key={moment.ts}>
                      <span>
                        <strong>{formatClock(moment.ts)}</strong>
                        <small>{formatDuration(moment.ts - s.createdAt)} in</small>
                      </span>
                      <strong>
                        {moment.score}
                        <LevelDot score={moment.score} />
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2 className="card-title">
                <span>Reactions</span>
                <span>{totalReactions}</span>
              </h2>
              <div className="reaction-counts">
                {REACTIONS.map((emoji) => (
                  <div className="reaction-count" key={emoji}>
                    <span aria-hidden="true">{emoji}</span>
                    <strong>{s.reactions[emoji] ?? 0}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Appear>
      </div>
    </main>
  );
}
