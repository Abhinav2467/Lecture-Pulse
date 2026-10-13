import { Suspense, lazy } from 'react';
import Gauge from './Gauge.jsx';
import { JoinQr } from './JoinPanel.jsx';
import Button from './ui/Button.jsx';

const ParticleField = lazy(() => import('./ParticleField.jsx'));

// Full-screen projector view: huge code + QR on the left, the gauge on the right.
export default function PresentMode({ code, pulse, topic, onExit }) {
  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Present mode">
      <Suspense fallback={null}>
        <ParticleField intensity={0.35} />
      </Suspense>

      <Button variant="ghost" size="sm" className="present-exit" onClick={onExit}>
        Exit <kbd>F</kbd>
      </Button>

      <div className="present-join">
        <p>
          Join at <strong>{window.location.host}</strong>
        </p>
        <div className="join-code">{code}</div>
        <JoinQr code={code} />
      </div>

      <div className="present-meter">
        <Gauge score={pulse.score} level={pulse.level} size="xl" />
        <p className="student-topic">
          {topic ? <>Now: <em>{topic.label}</em></> : null}
        </p>
        <p className="presence">
          <strong>{pulse.activeStudents}</strong> {pulse.activeStudents === 1 ? 'student' : 'students'} connected
        </p>
      </div>
    </div>
  );
}
