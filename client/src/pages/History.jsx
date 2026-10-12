import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StateScreen from '../components/StateScreen.jsx';
import { formatDateTime } from '../lib/format.js';
import { getHostSessions } from '../lib/storage.js';

export default function History() {
  const sessions = useMemo(() => [...getHostSessions()].sort((a, b) => b.createdAt - a.createdAt), []);

  if (sessions.length === 0) {
    return (
      <StateScreen icon="🗂️" title="No sessions yet" message="Sessions you host in this browser will show up here.">
        <Link className="btn btn--primary" to="/">Start a session</Link>
      </StateScreen>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Your sessions</h1>
        <p className="muted">Stored in this browser only.</p>
      </div>
      <ul className="history">
        {sessions.map((session) => (
          <li key={session.code} className="card history__item">
            <div>
              <div className="history__title">{session.title}</div>
              <div className="muted">
                <span className="mono">{session.code}</span> · {formatDateTime(session.createdAt)}
              </div>
            </div>
            <div className="row">
              <Link className="btn btn--ghost" to={`/host/${session.code}`}>Dashboard</Link>
              <Link className="btn" to={`/summary/${session.code}`}>Summary</Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
