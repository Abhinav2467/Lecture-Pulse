import { useMemo } from 'react';
import StateScreen from '../components/StateScreen.jsx';
import Appear from '../components/ui/Appear.jsx';
import Button from '../components/ui/Button.jsx';
import { formatDateTime } from '../lib/format.js';
import { getHostSessions } from '../lib/storage.js';

export default function History() {
  const sessions = useMemo(() => [...getHostSessions()].sort((a, b) => b.createdAt - a.createdAt), []);

  if (sessions.length === 0) {
    return (
      <main className="main">
        <StateScreen icon="clock" title={<>No sessions <em>yet</em></>} message="Sessions you host in this browser show up here.">
          <Button to="/#start">Start a Session</Button>
        </StateScreen>
      </main>
    );
  }

  return (
    <main className="main" style={{ maxWidth: 860 }}>
      <Appear className="page-head" variant="soft" delay={0.1}>
        <div>
          <div className="eyebrow">Stored in this browser only</div>
          <h1>
            Your <em>sessions</em>
          </h1>
        </div>
      </Appear>
      <ul className="history">
        {sessions.map((session, i) => (
          <Appear as="li" key={session.code} className="card history-item" variant="soft" delay={0.18 + Math.min(i, 8) * 0.06}>
            <div>
              <div className="history-title">{session.title}</div>
              <div className="history-meta">
                <span className="mono">{session.code}</span> · {formatDateTime(session.createdAt)}
              </div>
            </div>
            <div className="row">
              <Button variant="ghost" size="sm" to={`/host/${session.code}`}>Dashboard</Button>
              <Button size="sm" to={`/summary/${session.code}`}>Summary</Button>
            </div>
          </Appear>
        ))}
      </ul>
    </main>
  );
}
